import sys
import docker
import os
import platform
import time
from .utils import timers, neo4j_constants as constants
from .. import utils


def remove_neo4j_container(docker_client, container_name):
    try:
        container = docker_client.containers.get(container_name)
        container.stop()
        container.remove()
    except docker.errors.NotFound:
        print(f"Docker container {container_name} not found.")


def build_neo4j_image(docker_client):
    dockerfile_path = os.path.dirname(os.path.realpath(__file__))
    if platform.system() == 'Darwin':
        docker_client.images.build(path=dockerfile_path, tag="neo4j-docker", platform="linux/amd64")
    elif platform.system() == 'Linux':
        docker_client.images.build(path=dockerfile_path, tag="neo4j-docker", platform="linux/x86_64")
    else:
        docker_client.images.build(dockerfile_path, tag="neo4j-docker")


def create_neo4j_container(docker_client, container_name, graph_path, run_path, http_port, bolt_port):
    # Creating a special directory for the Docker logs.
    docker_logs_path = os.path.join(os.path.dirname(graph_path), "docker-logs")
    os.mkdir(docker_logs_path)
    container = docker_client.containers.run('neo4j-docker',
                                             name=container_name,
                                             ports={f"{http_port}": 7474, f"{bolt_port}": 7687},
                                             volumes={f"{graph_path}": {'bind': '/var/lib/neo4j/import', 'mode': 'rw'},
                                                      f"{run_path}": {'bind': '/var/lib/neo4j/runs', 'mode': 'rw'},
                                                      f"{docker_logs_path}": {'bind': '/var/lib/neo4j/logs',
                                                                              'mode': 'rw'}},
                                             environment={'PYTHONUNBUFFERED': 1, 'NEO4J_AUTH': f'{constants.NEO4J_USER}/{constants.NEO4J_PASSWORD}'},
                                             user=f'{constants.NEO4J_USER}:neo4j',
                                             detach=True)

    # Wait for container to start (timeout of 60sec)
    timer = 0
    time_increment = 1
    while 'Started' not in container.logs().decode("utf-8"):
        time.sleep(time_increment)
        timer = timer + time_increment
        if timer > 300:
            sys.exit("[ERROR] Neo4j container was not successfully created (Timed out).")

    return container


def import_csv_docker(graph_dir, output_dir, container_name="graphjs_neo4j", http_port=7474, bolt_port=7687):
    try:
        docker_client = docker.DockerClient()
    except docker.errors.DockerException as e:
        sys.exit(f"[ERROR] Unable to connect to Docker service: {e.code}.")

    # Stop and remove old container
    print("[INFO] - Remove existing container, if exists.")
    remove_neo4j_container(docker_client, container_name)
    # Build container
    # build_neo4j_image(docker_client)
    # Create new container
    print("[INFO] - Create Neo4j container.")
    neo4j_import_path = os.path.join(output_dir, "neo4j_import.txt")
    create_neo4j_container(docker_client, container_name, graph_dir, output_dir, http_port, bolt_port)
    time_output = os.path.join(output_dir, "time_stats.txt")
    utils.measure_import_time(neo4j_import_path, time_output)


def import_csv_local(graph_dir, output_dir):
    # To use neo4j-admin import, it is required to stop, import and then start neo4j again
    print("[INFO] Stop running Neo4j local instance.")
    neo4j_stop_path = os.path.join(output_dir, "neo4j_stop.txt")  # Write stop output to file
    utils.launch_process("neo4j", "stop", neo4j_stop_path)

    time_output = os.path.join(output_dir, "time_stats.txt")

    print("[INFO] Import MDG to Neo4j.")
    neo4j_import_path = os.path.join(output_dir, "neo4j_import.txt")
    utils.launch_process("neo4j-admin", f"database import full --overwrite-destination --nodes='{graph_dir}/nodes.csv"
                                        f"' --relationships='{graph_dir}/rels.csv' --delimiter=U+00BF "
                                        f"--skip-bad-relationships=true --skip-duplicate-nodes=true "
                                        f"--high-parallel-io=on",
                         neo4j_import_path)
    utils.measure_import_time(neo4j_import_path, time_output)

    print("[INFO] Starting Neo4j")
    neo4j_start_path = os.path.join(output_dir, "neo4j_start.txt")  # Write start output to file
    utils.launch_process_bg("neo4j", "console", 120, "Started", neo4j_start_path)
