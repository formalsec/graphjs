import sys

import docker
import os
import platform
import time
from .utils import constants


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


def create_neo4j_container(docker_client, container_name, graph_path, http_port, bolt_port):
    # Creating a special directory for the Docker logs.
    docker_logs_path = os.path.join(os.path.dirname(graph_path), "docker-logs")
    os.mkdir(docker_logs_path)
    container = docker_client.containers.run('neo4j-docker',
                                             name=container_name,
                                             ports={f"{http_port}": 7474, f"{bolt_port}": 7687},
                                             volumes={f"{graph_path}": {'bind': '/var/lib/neo4j/import', 'mode': 'rw'},
                                                      f"{docker_logs_path}": {'bind': '/var/lib/neo4j/logs',
                                                                              'mode': 'rw'}},
                                             environment={'PYTHONUNBUFFERED': 1, 'NEO4J_AUTH': f'{constants.NEO4J_USER}/{constants.NEO4J_PASSWORD}'},
                                             user="neo4j:neo4j",
                                             detach=True)

    # Wait for container to start (timeout of 60sec)
    timer = 0
    time_increment = 1
    while 'Started' not in container.logs().decode("utf-8"):
        time.sleep(time_increment)
        timer = timer + time_increment
        if timer > 60:
            sys.exit("[ERROR] Neo4j container was not successfully created.")

    return container


def import_csv(graph_dir, output_dir, container_name="graphjs_neo4j", http_port=7474, bolt_port=7687):
    try:
        docker_client = docker.DockerClient()
    except docker.errors.DockerException:
        sys.exit("[ERROR] Unable to connect to Docker service.")

    # Stop and remove old container
    print("[INFO] - Remove existing container, if exists.")
    remove_neo4j_container(docker_client, container_name)
    # Build container
    # build_neo4j_image(docker_client)
    # Create new container
    print("[INFO] - Create Neo4j container.")
    container = create_neo4j_container(docker_client, container_name, graph_dir, http_port, bolt_port)
    # Import csv to Neo4j
    print("[INFO] - Import MDG to Neo4j.")
    import_result = container.exec_run('''neo4j-admin database import full --overwrite-destination
                       --nodes=/var/lib/neo4j/import/nodes.csv --relationships=/var/lib/neo4j/import/rels.csv 
                      --delimiter=U+00BF --skip-bad-relationships=true --skip-duplicate-nodes=true''',
                                       user=f'{constants.NEO4J_USER}')
    if import_result.exit_code != 0:
        print(import_result)
        sys.exit("[ERROR] Unable to import data to Neo4j container.")

    # Write import output to file
    neo4j_import_path = os.path.join(output_dir, "neo4j_import.txt")
    with open(neo4j_import_path, "w") as f:
        f.write(import_result.output.decode("utf-8"))
