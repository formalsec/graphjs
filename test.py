import argparse
import ast
from colorama import Fore
import dill
import docker
from glob import glob
from glob import iglob
import json
import gspread
import shutil
import multiprocessing
from multiprocessing.managers import DictProxy
import os
import pathlib
import pprint
import random
import re
import shutil
import socket
import string
import subprocess
import sys
import time
from typing import Dict, List, Tuple


# Default datasets
VULNERABLE_EXAMPLE_DATASET = "datasets/example-dataset/vulnerable/proto_pollution/*"
INJECTION_DATASET = "./datasets/injection-dataset/CWE-471/*"
ZERODAY_DATASET = "./datasets/zeroday-dataset/packages/src/*"
ZERODAY_TESTED_LIST = "./datasets/zeroday-dataset/packages-tested.txt"
ZERODAY_CONCURRENT_LOGS = "./datasets/zeroday-dataset/concurrency-logs"

# Google Sheets Config
service_account = gspread.service_account(filename=".config/service_account.json")
sheet = service_account.open("explode.js-vs-odgen")

def clean_explodejs(dataset, exploit):
    for vulnerability in glob(dataset):
        print(Fore.MAGENTA + f"Cleaning explodejs results for {vulnerability}" + Fore.RESET)
        explodejs = os.path.join(vulnerability, "tool_outputs/explodejs")
        if "aux-files" in vulnerability:
            continue

        if not os.path.exists(explodejs):
            os.mkdir(explodejs)
        else:
            for file_name in os.listdir(explodejs):
                if not ("expected_output" in file_name or ("symbolic_test" in file_name and not exploit) or "symbolic_test_types" in file_name):
                    file_path = os.path.join(explodejs, file_name)
                    if os.path.isfile(file_path):
                        os.remove(file_path)
                    elif os.path.isdir(file_path):
                        shutil.rmtree(file_path)

def clean_odgen(dataset_path):
    for vulnerability in glob(dataset_path):
        print(Fore.MAGENTA + f"Cleaning ODGen results for {vulnerability}" + Fore.RESET)
        odgen = os.path.join(vulnerability, "tool_outputs/odgen")
        for file_name in os.listdir(odgen):
            file_path = os.path.join(odgen, file_name)
            if os.path.isfile(file_path):
                os.remove(file_path)

def test_odgen(dataset_path, dataset, update_sheets):
    print(Fore.MAGENTA + f"Running ODGen for vulnerabilities in {dataset_path}" + Fore.RESET)
    advisories = glob(dataset_path)
    count = 1
    ws = load_sheet(dataset)
    for adv in advisories:
        print(Fore.MAGENTA + f"{adv} ({count}/{len(advisories)})" + Fore.RESET)

        excluded = [
            "./datasets/injection-dataset/CWE-78/117",
            "./datasets/injection-dataset/CWE-94/551", 
            "./datasets/injection-dataset/CWE-94/813", 
            "./datasets/injection-dataset/CWE-94/835", 
            "./datasets/injection-dataset/CWE-94/1545", 
            "./datasets/injection-dataset/CWE-94/GHSA-54px-mhwv-5v8x", 
            "./datasets/injection-dataset/CWE-471/1329",
            "./datasets/injection-dataset/CWE-471/1483",
            "./datasets/injection-dataset/CWE-471/GHSA-r9w3-g83q-m6hq",
        ]
        
        if adv in excluded:
            continue

        src = os.path.join(adv, "src")
        odgen = os.path.join(adv, "tool_outputs/odgen")
        start = time.time()
        for vuln_file in os.listdir(src):
            if vuln_file != "simplified.js" and "-normalized.js" not in vuln_file:
                vuln_file = os.path.join(src, vuln_file)
                # os.system(f"python3 ~/inesc/ODGen/odgen.py -ma --timeout 400 -t os_command {vuln_file}")  
                # os.system(f"python3 ~/inesc/ODGen/odgen.py -ma --timeout 400 -t code_exec {vuln_file}")  
                os.system(f"python3 ~/inesc/ODGen/odgen.py -ma --timeout 400 -t proto_pollution {vuln_file}")  
                # os.system(f"python3 ~/inesc/ODGen/odgen.py -ma --timeout 400 -t ipt {vuln_file}")  
                # os.system(f"python3 ~/inesc/ODGen/odgen.py -ma --timeout 400 -t path_traversal {vuln_file}")  
                # os.system(f"python3 ~/inesc/ODGen/odgen.py -ma --timeout 400 -t xss {vuln_file}")  
        end = time.time()
        with open(os.path.join(odgen, "time.txt"), "w") as f:
            f.write(f"{end - start:.2f} seconds\n")
        logs = os.path.abspath("logs")
        for log in os.listdir(logs):
            shutil.move(os.path.join(logs, log), odgen)
        count += 1
    
        # Update sheet ODGen
        adv = adv.split("/")[-1]
        results_tmp_log = os.path.join(odgen, "results_tmp.log")
        cell = ws.find(adv, in_column=1)
        if os.stat(results_tmp_log).st_size == 0:
            ws.update_cell(cell.row, cell.col + 7, "D")
        elif ws.cell(cell.row, cell.col + 7).value == "D" and os.stat(results_tmp_log).st_size != 0:
            ws.update_cell(cell.row, cell.col + 7, "")


def test_explodejs(dataset_path, dataset, update_sheets, exploit, local):
    print(Fore.MAGENTA + f"Running Explode.js for vulnerabilities in {dataset_path}" + Fore.RESET)
    vulnerabilities = glob(dataset_path)
    count = 1 
    ws = load_sheet(dataset)
    for vulnerability_path in vulnerabilities:
        if "aux-files" in vulnerability_path:
            continue

        print(Fore.MAGENTA + f"{vulnerability_path} ({count}/{len(vulnerabilities)})" + Fore.RESET)

        excluded = [
            "./datasets/injection-dataset/CWE-78/117",
            "./datasets/injection-dataset/CWE-94/551", 
            "./datasets/injection-dataset/CWE-94/813", 
            "./datasets/injection-dataset/CWE-94/835", 
            "./datasets/injection-dataset/CWE-94/1545", 
            "./datasets/injection-dataset/CWE-94/GHSA-54px-mhwv-5v8x", 
            "./datasets/injection-dataset/CWE-471/1329",
            "./datasets/injection-dataset/CWE-471/1483",
            "./datasets/injection-dataset/CWE-471/GHSA-r9w3-g83q-m6hq",
        ]
        time_limit_exceeded = [
            "./datasets/injection-dataset/CWE-94/97", 
            "./datasets/injection-dataset/CWE-94/GHSA-cf4h-3jhx-xvhq",
            "./datasets/injection-dataset/CWE-94/GHSA-7fm6-gxqg-2pwr",
            "./datasets/injection-dataset/CWE-471/566",
            "./datasets/injection-dataset/CWE-471/577",
            # "./datasets/injection-dataset/CWE-471/995", # Should not be here TODO
            "./datasets/injection-dataset/CWE-471/1312", # Should not be here TODO
            "./datasets/injection-dataset/CWE-471/1065",
            "./datasets/injection-dataset/CWE-471/GHSA-8g4m-cjm2-96wq",
        ]

        if vulnerability_path in excluded or vulnerability_path in time_limit_exceeded:
            continue

        vulnerability_dir = vulnerability_path

        explodejs_path = os.path.join(vulnerability_path, "tool_outputs/explodejs")
        if not os.path.exists(explodejs_path):
            os.mkdir(explodejs_path)

        if dataset == "Injection Dataset" or dataset == "Injection Dataset - Test":
            vulnerability_path = os.path.join(vulnerability_path, "src")

        start = time.time()
        grades = {}
        for vulnerable_file in os.listdir(vulnerability_path):
            if (vulnerable_file.endswith(".js") or vulnerable_file.endswith(".cjs")) \
            and "-normalized.js" not in vulnerable_file and "simplified.js" not in vulnerable_file:
                explodejs_path = os.path.join(vulnerability_dir, f"tool_outputs/{vulnerable_file}_explodejs")
                vulnerable_file_path = os.path.join(vulnerability_path, vulnerable_file)
                taint_summary_file = os.path.join(explodejs_path, "taint_summary.json")
                norm_file = os.path.join(explodejs_path, "graph", "normalization.norm")
                expected_output_file = os.path.join(explodejs_path, "expected_output.json")
                symbolic_test_file = os.path.join(explodejs_path, "symbolic_test.js")
                if not exploit and local:
                    os.system(f"./explodejs-local.sh -f {vulnerable_file_path} -c config.json -o {taint_summary_file} -n {norm_file}")
                elif not exploit and not local:
                    os.system(f"./explodejs.sh -f {vulnerable_file_path} -c config.json -e {explodejs_path}")
                elif exploit and local:
                    os.system(f"./explodejs-local.sh -xf {vulnerable_file_path} -c config.json -o {taint_summary_file} -t {symbolic_test_file} -n {norm_file}")
                else:
                    os.system(f"./explodejs.sh -xf {vulnerable_file_path} -c config.json -e {explodejs_path}")
                check_graph_construction(grades, norm_file)
                comapre_outputs(grades, expected_output_file, taint_summary_file)
                check_symb_test_generation(grades, symbolic_test_file, explodejs_path)
                print("Intermdiate grades:", grades)
        print("Final grades:", grades)

        if update_sheets: update_sheet(ws, dataset, vulnerability_path, grades)

        end = time.time()
        with open(os.path.join(explodejs_path, "time.txt"), "w") as f:
            f.write(f"{end - start:.2f} seconds\n")
        count += 1


def check_graph_construction(grades, norm_file):
    with open(norm_file, "r") as f:
        file_content = f.read()
        regex = re.compile(r'Error: [A-Za-z]*Error')
        if regex.search(file_content):
            grades["graph_construction"] = chr(max(ord(grades.get("graph_construction", "0")), ord("D")))
        elif "Trace: Expression" in file_content:
            grades["graph_construction"] = chr(max(ord(grades.get("graph_construction", "0")), ord("C")))
        else:
            grades["graph_construction"] = chr(max(ord(grades.get("graph_construction", "0")), ord("A")))

def check_symb_test_generation(grades, symb_test_file, explodejs_path):
    symb_test_file = os.path.basename(os.path.splitext(symb_test_file)[0])
    for file in os.listdir(explodejs_path):
        if symb_test_file in file:
            with open(os.path.join(explodejs_path, file), "r") as f:
                symb_test_str = f.read()
                if "esl_symbolic." in symb_test_str:
                    grades["symb_test"] = "A"
                else:
                    grades["symb_test"] = "C"
            break
    else:
        grades["symb_test"] = "D"

def split_string_with_nested_structures(string, separator):
    result = []
    nested_level = 0
    current_item = ''

    for char in string:
        if char == separator and nested_level == 0:
            result.append(current_item.strip())
            current_item = ''
        else:
            current_item += char
            if char == '[' or char == '{':
                nested_level += 1
            elif char == ']' or char == '}':
                nested_level -= 1

    result.append(current_item.strip())

    return result

def is_valid_list_or_dict(string):
    try:
        ast.literal_eval(string)
        return True
    except (ValueError, SyntaxError):
        return False

def compare_params_types(expected, output):
    if isinstance(expected, dict):
        if isinstance(output, str):
            for ty in split_string_with_nested_structures(output, "|"):
                if is_valid_list_or_dict(ty) and isinstance(ast.literal_eval(ty), dict):
                    if not compare_params_types(expected, ast.literal_eval(ty)):
                        return False
                    else:
                        break
            else:
                return False

        elif isinstance(output, dict):
            if set(expected.keys()) != set(output.keys()):
                return False

            for key in expected:
                if not compare_params_types(expected[key], output[key]):
                    return False
        else:
            return False 
    
    elif isinstance(expected, list):
        if isinstance(output, str):
            for ty in split_string_with_nested_structures(output, "|"):
                if is_valid_list_or_dict(ty) and isinstance(ast.literal_eval(ty), list):
                    if not compare_params_types(expected, ast.literal_eval(ty)):
                        return False
                    else:
                        break
            else:
                return False

        elif isinstance(output, list):
            for i in range(len(expected)):
                if not compare_params_types(expected[i], output[i]):
                    return False
        else:
            return False 

    elif isinstance(expected, str) and isinstance(output, str):
        if expected != "any":
            set_expected = set(expected.split(" | "))
            set_output = set(output.split(" | "))
            if not set_expected.issubset(set_output):
                return False
    
    else:
        return False

    return True

def comapre_outputs(grades, expected_output, output):
    try:
        expected = json.load(open(expected_output))
    except FileNotFoundError:
        print("Expected output file does not exist!")
        grades["detection"] = "E"
        grades["data_reconstruction"] = "E"
        return 

    try:
        out = json.load(open(output))
    except FileNotFoundError:
        grades["detection"] = "E"
        grades["data_reconstruction"] = "E"
        print("Output file does not exist!")
        return    

    num_vulns = len(expected)
    if num_vulns == 0:
        grades["detection"] = chr(max(ord(grades.get("detection", "0")), ord("A")))
        grades["data_reconstruction"] = chr(max(ord(grades.get("data_reconstruction", "0")), ord("A")))
        return

    detected_vulns = 0
    reconstructed_data = 0
    detection_props = ["vuln_type", "source", "source_lineno", "sink", "sink_lineno", "tainted_params"]
    for ex_vuln in expected:
        for o in out:
            # Check if detection was successfull
            for prop in detection_props:
                if ex_vuln[prop] != o[prop]:
                    break
            else:
                detected_vulns += 1
                # Check if data reconstruction was successfull
                # if ex_vuln["params_types"] == o["params_types"]:
                if compare_params_types(ex_vuln["params_types"], o["params_types"]):
                    reconstructed_data += 1
                break

    detection_rate = detected_vulns / num_vulns 
    if detection_rate == 1:
        grades["detection"] = chr(max(ord(grades.get("detection", "0")), ord("A")))
    elif 0.5 <= detection_rate < 1:
        grades["detection"] = chr(max(ord(grades.get("detection", "0")), ord("B")))
    elif 0 < detection_rate < 0.5:
        grades["detection"] = chr(max(ord(grades.get("detection", "0")), ord("C")))
    else:
        grades["detection"] = chr(max(ord(grades.get("detection", "0")), ord("D")))

    reconstruction_rate = reconstructed_data / num_vulns 
    if reconstruction_rate == 1:
        grades["data_reconstruction"] = chr(max(ord(grades.get("data_reconstruction", "0")), ord("A")))
    elif 0.5 <= reconstruction_rate < 1:
        grades["data_reconstruction"] = chr(max(ord(grades.get("data_reconstruction", "0")), ord("B")))
    elif 0 < reconstruction_rate < 0.5:
        grades["data_reconstruction"] = chr(max(ord(grades.get("data_reconstruction", "0")), ord("C")))
    else:
        grades["data_reconstruction"] = chr(max(ord(grades.get("data_reconstruction", "0")), ord("D")))

    return grades


def load_sheet(sheet_name):
    return sheet.worksheet(sheet_name)


def update_sheet(ws, dataset, vulnerable_file, grades):
    if dataset == "Example Dataset" or dataset == "Example Dataset - Test":
        vulnerable_file = "/".join(vulnerable_file.split("/")[2:])
        cell = ws.find(vulnerable_file)
        ws.update_cell(cell.row, cell.col + 1, grades.get("graph_construction", "NaN"))
        ws.update_cell(cell.row, cell.col + 2, grades.get("detection", "NaN"))
        ws.update_cell(cell.row, cell.col + 3, grades.get("data_reconstruction", "NaN"))
        ws.update_cell(cell.row, cell.col + 4, grades.get("symb_test", "NaN"))
        ws.update_cell(cell.row, cell.col + 5, grades.get("confirmation", "NaN"))
    elif dataset == "Injection Dataset" or dataset == "Injection Dataset - Test":
        vulnerable_file = vulnerable_file.split("/")[-2]
        cell = ws.find(vulnerable_file, in_column=1)
        if ws.cell(cell.row, cell.col + 2).value != grades.get("graph_construction", "NaN"):
            ws.update_cell(cell.row, cell.col + 2, grades.get("graph_construction", "NaN"))
        if ws.cell(cell.row, cell.col + 3).value != grades.get("detection", "NaN"):
            ws.update_cell(cell.row, cell.col + 3, grades.get("detection", "NaN"))
        if ws.cell(cell.row, cell.col + 4).value != grades.get("data_reconstruction", "NaN"):
            ws.update_cell(cell.row, cell.col + 4, grades.get("data_reconstruction", "NaN"))
        if ws.cell(cell.row, cell.col + 5).value != grades.get("symb_test", "NaN"):
            ws.update_cell(cell.row, cell.col + 5, grades.get("symb_test", "NaN"))
        ws.update_cell(cell.row, cell.col, vulnerable_file)

    else:
        print(Fore.RED + "The given dataset is not present in the sheet" + Fore.RESET)
        return

def check_vulnerability_detection(grades, taint_summary_file) -> None:
    vulnerabilities = ['command-injection', 'path-traversal', 'code-injection', 'prototype-pollution']
    found_vulns = []

    with open(taint_summary_file, 'r') as file:
        content = file.read()

    for vuln in vulnerabilities:
        if vuln in content:
            found_vulns.append(vuln)

    grades["detection"] = ", ".join(found_vulns) if len(found_vulns) > 0 else "D"

def check_graph_construction_zeroday(grades, norm_file) -> None:
    with open(norm_file, "r") as f:
        file_content = f.read()
        regex = re.compile(r'Error: [A-Za-z]*Error')
        if regex.search(file_content):
            grades["graph_construction"] = "D"
        elif "Trace: Expression" in file_content:
            grades["graph_construction"] = "C"
        else:
            grades["graph_construction"] = "A"


def check_if_package_was_tested(package: str, packages_tested_file_path: str) -> bool:
    if not os.path.isfile(packages_tested_file_path):
        f = open(packages_tested_file_path, 'w')
        f.close()

    with open(packages_tested_file_path, 'r') as file:
        for line in file:
            words = line.strip().split()
            if package in words:
                return True
    return False

def add_package_to_tested_list(package: str, packages_tested_file_path: str) -> None:
    with open(packages_tested_file_path, 'a') as file:
        file.write(package + '\n')

def add_package_to_sheet(ws: gspread.Spreadsheet, package: str) -> None:
    package_cell = ws.find(package)
    empty_row_index = max(len(ws.col_values(2)) + 1, 6)
    if not package_cell:
        ws.update_cell(empty_row_index, 1, package)

def update_zeroday_sheet(ws: gspread.Spreadsheet, package: str, package_grades: Dict[str, Dict[str, Dict]]) -> None:
    result = []
    for file, grades in package_grades.items():
        sub_array = ["", "/".join(file.split("/")[5:])] + [grades[key] for key in grades] 
        sub_array.insert(4, "")
        result.append(sub_array)
    result[0][0] = package

    empty_row_index = max(len(ws.col_values(2)) + 1, 6)

    try:
        ws.update(f"A{empty_row_index}:F{len(result) + empty_row_index - 1}", result)
        return
    except gspread.exceptions.APIError as e:
        print(e.response, flush=True)
        error_json = e.response.json()

        error_code: int = error_json.get("error", {}).get("code")
        error_status: str = error_json.get("error", {}).get("status")
        error_message: str = error_json.get("error", {}).get("message")

        # If the exception was due to the row limit being hit, need to extend the sheet with more rows.
        if error_code == 400 and error_status == "INVALID_ARGUMENT" and "exceeds greed limits" in error_message:
            row_incr: int = 1000
            print(f'Adding {row_incr} rows to {ws.title}')
            ws.add_rows(row_incr)
        else:
            raise e

        #pprint.pprint(error_json)
        #pprint.pprint(e)
        #sys.stdout.flush()
        #raise e
    finally:
        # If the limit had been reached and it was extended successfully, try to write again.
        print(f'Trying to write to sheet {ws.title} again.')
        ws.update(f"A{empty_row_index}:F{len(result) + empty_row_index - 1}", result)

def get_js_files(package_path):
    js_files = []
    for root, dirs, files in os.walk(package_path):
        # Exclude directories ending with "_explodejs"
        dirs[:] = [d for d in dirs if not d.endswith("_explodejs")]

        # Filter and collect JS files
        js_files.extend([os.path.join(root, file) for file in files if file.endswith(".js") or file.endswith(".cjs")])

    return js_files


def find_exclusive_port(pid: int, process_port_map: DictProxy, base_port: int = 1024) -> int:
    """
    Identify an exclusive port and return it.
    To be used within a :class:`multiprocessing.Lock` returned from :method:`multiprocessing.Manager.Lock()`.

    @param: pid Current worker process PID. 
    @param: process_port_map Used to check if a port is already reserved for a specific pool process when this function is called again.
    @param: base_port The search for free TCP ports starts from this one and proceeds in increments of one.

    """

    def next_free_port( port: int = 1024, max_port: int = 65535 ):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        while port <= max_port:
            try:
                sock.bind(('', port))
                sock.close()
                return port
            except OSError:
                port += 1
        raise IOError('no free ports')

    port: int = -1
    while True:
        if port == -1:
            port = next_free_port(port=base_port)
        
        if port in process_port_map.keys() and (not process_port_map[port] == pid):
            base_port = port + 1
            port = -1
        else:
            process_port_map[port] = pid
            return port

def test_zeroday_task(package: str, file_path: str,  io_lock: multiprocessing.Lock, process_port_map: DictProxy) -> Tuple[str, str, Dict]:
    """
    Function to be run by each concurrent process.

    @param: package The name of the NPM package. 
    @param: file_path The path of the file to inspect within the NPM package. 
    @param: io_lock A multiprocessing.Lock for coordination between processes.

    For every NPM package and individual file, this function is executed by one of the processes of :class:`multiprocessing.Pool`.
    This function is currently being called from within :func:`test_zeroday_dataset_p()` with :method:`multiprocessing.Pool.imap_unordered()` over a list of tuples like this::


    for result in pool.imap_unordered(test_zeroday_task_star, package_f_tuples):
        res_package = result[0]
        res_file = result[1]
        res_grades = result[2]
       
    
    """

    f_name: str = file_path[file_path.rfind(f"src{os.path.sep}") + 4:].replace(os.path.sep, "-")
    pid: int = os.getpid()
    log_file: str = f"PID-{pid}-{package}-{f_name}.log"
    log_path: str = os.path.join(ZERODAY_CONCURRENT_LOGS, log_file)

    with open(log_path, 'w') as sys.stdout:

        # Exclusion zone to avoid concurrent multiprocessing.Pool 'test_zeroday_task' workers 
        # picking the same free ports. 
        # This would make concurrent Docker Neo4j containers not work properly.
        io_lock.acquire()

        # Get ports for Docker Neo4j process port mapping.
        http_port: int = find_exclusive_port(pid, process_port_map, base_port=1024)
        bolt_port: int = find_exclusive_port(pid, process_port_map, base_port=http_port + 1)
        
        print(Fore.MAGENTA + f'PID {pid} - Running Explode.js for PACKAGE: {package} || FILE: {file_path}' + Fore.RESET, flush=True)
        print(f"PID {pid} HTTP {http_port} BOLT {bolt_port}")
        io_lock.release()

        grades: Dict = {}
    
        explodejs_path = f"{file_path}_explodejs"
        taint_summary_file = os.path.join(explodejs_path, "taint_summary.json")
        norm_file = os.path.join(explodejs_path, "graph", "normalization.norm")
        symbolic_test_file = os.path.join(explodejs_path, "symbolic_test.js")
        grades_explodejs = os.path.join(explodejs_path, "grades.json")

        print(f'> File: {file_path}')
        print(f'\t: {taint_summary_file}')
        print(f'\t: {norm_file}')
        print(f'\t: {symbolic_test_file}')
        print(f'\t: {grades_explodejs}')

        try:
            start = time.time()
            
            
            neo4j_container_name: str = package + "_" + f_name
            neo4j_container_name = neo4j_container_name.replace(" ", "-").replace("\t", "-").replace("@", "AT")
            docker_container_max_len: int = 128

            # Check container name length - Docker has a limit of 128 characters.
            # Shrink container name if it is greater than 128.
            if len(neo4j_container_name) > docker_container_max_len:
                letters = string.ascii_lowercase
                rand_sz: int = 4
                result_str: str = ''.join(random.choice(letters) for i in range(rand_sz))
                
                neo4j_container_name = result_str + neo4j_container_name[len(result_str) - docker_container_max_len :]

            explode_js_cmd = f'./explodejs.sh -xf "{file_path}" -p {neo4j_container_name} -c config.json -e "{explodejs_path}" -w {http_port} -b {bolt_port}'
            io_lock.acquire()
            print(Fore.MAGENTA + f'PID {os.getpid()} - {explode_js_cmd}' + Fore.RESET, flush=True)
            io_lock.release()

            subprocess.run(explode_js_cmd, shell=True, check=True, timeout=300, stdout=sys.stdout, stderr=sys.stdout)
            
            
            end = time.time()
            with open(os.path.join(explodejs_path, "time.txt"), "w") as f:
                f.write(f"{end - start:.2f} seconds\n")
            check_graph_construction_zeroday(grades, norm_file)
            check_vulnerability_detection(grades, taint_summary_file)
            check_symb_test_generation(grades, symbolic_test_file, explodejs_path)
        except subprocess.TimeoutExpired:
            io_lock.acquire()
            print(Fore.MAGENTA + f'PID {os.getpid()} - subprocess.TimeoutExpired' + Fore.RESET, flush=True)
            io_lock.release()

            if os.path.exists(norm_file):
                check_graph_construction_zeroday(grades, norm_file)
            else: 
                grades["graph_construction"] = "TIMEOUT"
            if os.path.exists(taint_summary_file):
                check_graph_construction_zeroday(grades, taint_summary_file)
            else:
                grades["detection"] = "TIMEOUT"
            grades["symb_test"] = "TIMEOUT"

            # Need to stop the Docker container if it still exists after the timeout triggered.          
            io_lock.acquire()
            print(Fore.MAGENTA + f'PID {pid} - checking if container {neo4j_container_name} is still running after timeout.' + Fore.RESET, flush=True)
            io_lock.release()

            # Check list of Docker container names.
            docker_client = docker.from_env()
            running_containers: List[docker.Container] = docker_client.containers.list()
            docker_container_names: List[str] = [container.name for container in running_containers]
        
            # Stop the container in case it still existed.
            # NOTE: this could be used with docker_client while avoiding a subprocess, perhaps...
            if neo4j_container_name in docker_container_names:

                docker_stop_cmd: str = f'docker stop {neo4j_container_name}'
                io_lock.acquire()
                print(Fore.MAGENTA + f'PID {pid} - container {neo4j_container_name} still running after timeout, calling "docker stop {neo4j_container_name}"' + Fore.RESET, flush=True)
                print(Fore.MAGENTA + f'PID {pid} - {docker_stop_cmd}' + Fore.RESET, flush=True)
                io_lock.release()


                result = subprocess.run(docker_stop_cmd, shell=True, check=False, stdout=sys.stdout, stderr=sys.stdout)

        except subprocess.CalledProcessError as e:
            io_lock.acquire()
            print(Fore.MAGENTA + f'PID {pid} - subprocess.CalledProcessError' + Fore.RESET, flush=True)
            io_lock.release()

            if os.path.exists(norm_file):
                check_graph_construction_zeroday(grades, norm_file)
            else: 
                grades["graph_construction"] = "ERROR"
            if os.path.exists(taint_summary_file):
                check_vulnerability_detection(grades, taint_summary_file)
            else:
                grades["detection"] = "ERROR"
            grades["symb_test"] = "ERROR"

        with open(grades_explodejs, "w") as f:
            f.write(json.dumps(grades, indent=4) + '\n')

    return (package, file_path, grades)

def test_zeroday_task_star(args: Tuple[str, str, multiprocessing.Lock, DictProxy]) -> Tuple[str, str, Dict]:
    """
    Receives a tuple which containing arguments for :func:`test_zeroday_task` which are passed with `*args`.
    This is needed due to :func:`imap_unordered` being able to pass only one argument to the worker function.

    @param: args A tuple with an NPM package's individual file to process. 
    """
    return test_zeroday_task(*args)

def test_zeroday_dataset_p(target_sheet_name: str = "ZeroDay Dataset", concurrency_level: int = 1, package_start_ind: int = 0, package_finish_ind: int = 0):
    """
    Makes a list of all the NPM package files and distributs their analysis across a :class:`multiprocessing.Pool` of concurrent processes.

    @param: target_sheet_name The name of the Google Sheets sheet to use.
    @param concurrency_level: the size of the :class:`multiprocessing.Pool` to use for concurrent processses.
    """

    # Create worksheet if it does not exist.
    try:
        ws: gspread.Spreadsheet = load_sheet(target_sheet_name)
        print("Loaded gspread.Spreadsheet: {}".format(target_sheet_name))
    except gspread.exceptions.WorksheetNotFound:
        ws = sheet.add_worksheet(target_sheet_name,"999","20")
        print("gspread.Spreadsheet {} not found. Created one.".format(target_sheet_name))

    
    package_paths: List[str] = glob(ZERODAY_DATASET)
    package_paths.sort()

    if len(package_paths) == 0:
        print("> Zeroday dataset: found zero packages ot process. Perhaps an argument error? Exiting.")
        sys.exit(1)

    print(f'Zeroday dataset directory: {ZERODAY_DATASET}')
    

    if package_finish_ind == 0:
        package_paths = package_paths[package_start_ind:len(package_paths)]
    else:
        package_paths = package_paths[package_start_ind:package_finish_ind]



    print(f'Processing packages {package_start_ind}-{package_start_ind+len(package_paths)}')

    #print(f'#packages {len(package_paths)}')

    for pp in package_paths:
        print(f'\t{pp}')

    #sys.exit(0)


    # Manager to share dictionary among processes.
    multiprocessing.set_start_method("spawn")
    with multiprocessing.Manager() as manager:

        # This lock is to avoid garbled output of multiple processes.
        io_lock: multiprocessing.Lock = manager.Lock()
        
        package_file_count: DictProxy = manager.dict()

        process_map: DictProxy = manager.dict()

        package_f_tuples: List[Tuple[str, multiprocessing.Lock]] = []

        package_grades: Dict[str, Dict[str, Dict]] = {}
        
        # First we iterate the set of packages to know how many files each package has.
        for package_path in package_paths:
            package = os.path.basename(package_path)
            # Skipping those that have been tested before first.

            

            if check_if_package_was_tested(package, ZERODAY_TESTED_LIST):
                print(Fore.MAGENTA + f'Package "{package}" has already been tested' + Fore.RESET)
                continue
            else:
                

                file_paths: List[str] = get_js_files(package_path)
                package_file_count[package] = len(file_paths)
                for f in file_paths:
                    explodejs_path = f"{f}_explodejs"
                    grades_explodejs: str = os.path.join(explodejs_path, "grades.json")

                    # If the current file had already been processed (results found on disk), 
                    # load its grades.
                    if os.path.exists(grades_explodejs) and os.path.isfile(grades_explodejs):

                        if not package in package_grades:
                            package_grades[package] = {}
                        
                        res_grades = json.load(open(grades_explodejs, "r"))

                        package_grades[package][f] = res_grades

                        package_file_count[package] -= 1
                    else:
                        package_f_tuples.append((package, f, io_lock, process_map))
        

        # Create a process pool with the specified 'concurrency_level'.
        # Argument 'maxtasksperchild' limits how many task 'test_zeroday_task' executions
        # will occur before the process is killed and a new one is created.
        # This improves resource efficiency.
        # See: https://docs.python.org/3/library/multiprocessing.html#multiprocessing.pool.Pool
        
        
        print("Creating pool with {} workers.".format(concurrency_level))
        # See pitfalls of running multiprocessing.Pool:
        # https://pythonspeed.com/articles/python-multiprocessing/
        pool: multiprocessing.Pool = multiprocessing.pool.Pool(processes=concurrency_level)
       

        # Create directory for individual worker process logs.
        os.makedirs(ZERODAY_CONCURRENT_LOGS, exist_ok=True)
        

        # test_list = package_f_tuples[0:7]

        # print("TEST TUPLES")
        # pprint.pprint(test_list)
        # print("")
        # print("")

        # See: https://superfastpython.com/multiprocessing-pool-imap_unordered/#How_to_Use_Poolimap_unordered
        # https://docs.python.org/3/library/multiprocessing.html#multiprocessing.pool.Pool.imap_unordered
        # https://superfastpython.com/multiprocessing-pool-issue-tasks/
        for result in pool.imap_unordered(test_zeroday_task_star, package_f_tuples):
            res_package: str = result[0]
            res_file: str = result[1]
            res_grades: Dict = result[2]

            # Debug prints, left here in case they are needed.
            # print("")
            # print("")
            # pprint.pprint(f"{res_package} | {res_file}")
            # pprint.pprint(res_grades)
            
            # NOTE: This lock.aquire() may be unnecessary, research it...
            io_lock.acquire()

            if not res_package in package_grades:
                package_grades[res_package] = {}
            package_grades[res_package][res_file] = res_grades

            #print(f'[{res_package}][{res_file}] done')
            #print(f'[{res_package}]: {package_file_count[res_package]}/{} files left')

            package_file_count[res_package] -= 1


            
            if package_file_count[res_package] == 0:
                update_zeroday_sheet(ws, res_package, package_grades[res_package])
                add_package_to_tested_list(res_package, ZERODAY_TESTED_LIST)

            # NOTE: This lock.release() may be unnecessary
            io_lock.release()       

        
        pool.close()
        pool.join()

    
def test_zeroday_dataset():
    ws = load_sheet("ZeroDay Dataset")
    for package_path in glob(ZERODAY_DATASET):
        package = os.path.basename(package_path)
        if not check_if_package_was_tested(package, ZERODAY_TESTED_LIST):
            print(Fore.MAGENTA + f'Running Explode.js for PACKAGE: {package}' + Fore.RESET)
            add_package_to_sheet(ws, package)
            for file in get_js_files(package_path):
                print(Fore.MAGENTA + f'Running Explode.js for FILE: {file}' + Fore.RESET)
                grades = {}
                explodejs_path = f"{file}_explodejs"
                taint_summary_file = os.path.join(explodejs_path, "taint_summary.json")
                norm_file = os.path.join(explodejs_path, "graph", "normalization.norm")
                symbolic_test_file = os.path.join(explodejs_path, "symbolic_test.js")

                try:
                    start = time.time()
                    subprocess.run(f"./explodejs.sh -xf {file} -c config.json -e {explodejs_path}", shell=True, check=True, timeout=300)
                    end = time.time()
                    with open(os.path.join(explodejs_path, "time.txt"), "w") as f:
                        f.write(f"{end - start:.2f} seconds\n")
                    check_graph_construction_zeroday(grades, norm_file)
                    check_vulnerability_detection(grades, taint_summary_file)
                    check_symb_test_generation(grades, symbolic_test_file, explodejs_path)
                except subprocess.TimeoutExpired:
                    if os.path.exists(norm_file):
                        check_graph_construction_zeroday(grades, norm_file)
                    else: 
                        grades["graph_construction"] = "TIMEOUT"
                    if os.path.exists(taint_summary_file):
                        check_graph_construction_zeroday(grades, taint_summary_file)
                    else:
                        grades["detection"] = "TIMEOUT"
                    grades["symb_test"] = "TIMEOUT"
                    subprocess.run(f"docker stop neo4j-explodejs", shell=True, check=True)
                    print(Fore.RED + f"Explode.js timed out after 300 seconds!" + Fore.RESET)
                except subprocess.CalledProcessError as e:
                    if os.path.exists(norm_file):
                        check_graph_construction_zeroday(grades, norm_file)
                    else: 
                        grades["graph_construction"] = "ERROR"
                    if os.path.exists(taint_summary_file):
                        check_vulnerability_detection(grades, taint_summary_file)
                    else:
                        grades["detection"] = "ERROR"
                    grades["symb_test"] = "ERROR"

                print("Grades:", grades)
                update_zeroday_sheet(ws, package, file, grades)
            add_package_to_tested_list(package, ZERODAY_TESTED_LIST)
        else:
            print(Fore.MAGENTA + f'Package "{package}" has already been tested' + Fore.RESET)



if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("tool", choices=["explode.js", "odgen", "zeroday"], 
                        help="Which tool should be tested?")
    parser.add_argument("-d", type=str, default="example",
                        help="What dataset should be tested?")
    parser.add_argument("-u", action="store_true",
                        help="Update google sheets?")
    parser.add_argument("-t", action="store_true")
    parser.add_argument("-x", action="store_true",
                        help="Update google sheets?")
    parser.add_argument("-l", action="store_true",
                        help="Run neo4j locally")
    parser.add_argument("-p", "--parallelism", type=int, default=1)
    parser.add_argument("-s", "--start-package", type=int, default=0,
                        help="Index of the package to start processing. Must be a non-negative integer lower than the value of '-f/--finish-package'.")
    parser.add_argument("-f", "--finish-package", type=int, default=0,
                        help="Index of the package to finish processing. Must be an integer greater than '-s/--start-package'")
    args = parser.parse_args()

    ###### Argument sanity checking.

    # Range of packages to evaluate in this execution.
    if not (args.start_package == 0 and args.finish_package == 0):
        if args.start_package < 0:
            print(f"Error. '-s/--start_package' must be a non-negative integer. Exiting.")
            sys.exit(1)
        elif args.finish_package < 0:
            print(f"Error. '-f/--finish_package' must be a non-negative integer. Exiting.")
            sys.exit(1)
        elif args.start_package >= args.finish_package:
            print(f"Error. '-s/--start-package' must be less than '-f/--finish-package'. Exiting.")
            sys.exit(1)
    
    # Parallelism level.
    if args.parallelism < 1:
        print(f"Error. '-p/--parallelism' must be an integer greater than one. Exiting.")
        sys.exit(1)


    #pprint.pprint(args)
    #sys.exit(0)
    if args.tool == "explode.js" and args.d == "zeroday":
        #test_zeroday_dataset()

        sheet_name: str = "ZeroDay Concurrent Test"

        if not (args.start_package == 0 and args.finish_package == 0):
            sheet_name = f"ZDC-{args.start_package}-{args.finish_package}"


        test_zeroday_dataset_p(target_sheet_name = sheet_name, concurrency_level = args.parallelism, 
                               package_start_ind=args.start_package, package_finish_ind=args.finish_package)
    elif args.tool == "explode.js" and ("d" not in args or args.d == "example") and not args.t:
        # clean(VULNERABLE_EXAMPLE_DATASET, args.x)
        test_explodejs(VULNERABLE_EXAMPLE_DATASET, "Example Dataset", args.u, args.x, args.l)
    elif args.tool == "explode.js" and ("d" not in args or args.d == "example") and args.t:
        # clean(VULNERABLE_EXAMPLE_DATASET, args.x)
        test_explodejs(VULNERABLE_EXAMPLE_DATASET, "Example Dataset - Test", args.u, args.x, args.l)
    

    elif args.tool == "explode.js" and args.d == "injection" and not args.t:
        clean_explodejs(INJECTION_DATASET, args.x)
        test_explodejs(INJECTION_DATASET, "Injection Dataset", args.u, args.x, args.l)
    elif args.tool == "explode.js" and args.d == "injection" and args.t:
        clean_explodejs(INJECTION_DATASET, args.x)
        test_explodejs(INJECTION_DATASET, "Injection Dataset - Test", args.u, args.x, args.l)
    elif args.tool == "odgen" and ("d" not in args or args.d == "example"):
        clean_odgen(VULNERABLE_EXAMPLE_DATASET)
        test_odgen(VULNERABLE_EXAMPLE_DATASET, "Example Dataset", args.u)
    elif args.tool == "odgen" and args.d == "injection":
        clean_odgen(INJECTION_DATASET)
        test_odgen(INJECTION_DATASET, "Injection Dataset", args.u)
    #elif args.tool == "zeroday":
    #    test_zeroday_dataset()
