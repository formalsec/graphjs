import argparse
import ast
from colorama import Fore
import dill
from glob import glob
from glob import iglob
import json
import gspread
import multiprocessing
from multiprocessing.managers import DictProxy
import os
import pprint
import re
import subprocess
import sys
import time





# Default datasets
VULNERABLE_EXAMPLE_DATASET = "datasets/example-dataset/vulnerable/proto_pollution/*"
INJECTION_DATASET = "./datasets/injection-dataset/CWE-471/717"
ZERODAY_DATASET = "./datasets/zeroday-dataset/packages/src/*"

# Google Sheets Config
service_account = gspread.service_account(filename=".config/service_account.json")
sheet = service_account.open("explode.js-vs-odgen")

def clean(dataset, exploit):
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

def test_odgen(dataset_path, dataset, update_sheets):
    print(Fore.MAGENTA + f"Running ODGen for vulnerabilities in {dataset_path}" + Fore.RESET)

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

def check_vulnerability_detection(grades, taint_summary_file):
    vulnerabilities = ['command-injection', 'path-traversal', 'code-injection', 'prototype-pollution']
    found_vulns = []

    with open(taint_summary_file, 'r') as file:
        content = file.read()

    for vuln in vulnerabilities:
        if vuln in content:
            found_vulns.append(vuln)

    grades["detection"] = ", ".join(found_vulns) if len(found_vulns) > 0 else "D"

def check_graph_construction_zeroday(grades, norm_file):
    with open(norm_file, "r") as f:
        file_content = f.read()
        regex = re.compile(r'Error: [A-Za-z]*Error')
        if regex.search(file_content):
            grades["graph_construction"] = "D"
        elif "Trace: Expression" in file_content:
            grades["graph_construction"] = "C"
        else:
            grades["graph_construction"] = "A"


def check_if_package_was_tested(package):
    with open("./datasets/zeroday-dataset/packages-tested.txt", 'r') as file:
        for line in file:
            words = line.strip().split()
            if package in words:
                return True
    return False

def add_package_to_tested_list(package):
    with open("./datasets/zeroday-dataset/packages-tested.txt", 'a') as file:
        file.write(package + '\n')

def add_package_to_sheet(ws, package):
    package_cell = ws.find(package)
    empty_row_index = max(len(ws.col_values(2)) + 1, 6)
    if not package_cell:
        ws.update_cell(empty_row_index, 1, package)

def update_zeroday_sheet(ws, package, file, grades):
    file = "/".join(file.split("/")[5:])
    empty_row_index = max(len(ws.col_values(2)) + 1, 6)
    file_cell = ws.find(file)
    if not file_cell:
        ws.update_cell(empty_row_index, 2, file)
        ws.update_cell(empty_row_index, 3, grades["graph_construction"])
        ws.update_cell(empty_row_index, 4, grades["detection"])
        ws.update_cell(empty_row_index, 6, grades["symb_test"])
    else:
        ws.update_cell(file_cell.row, 3, grades["graph_construction"])
        ws.update_cell(file_cell.row, 4, grades["detection"])
        ws.update_cell(file_cell.row, 6, grades["symb_test"])

def get_js_files(package_path):
    js_files = []
    for root, dirs, files in os.walk(package_path):
        # Exclude directories ending with "_explodejs"
        dirs[:] = [d for d in dirs if not d.endswith("_explodejs")]

        # Filter and collect JS files
        js_files.extend([os.path.join(root, file) for file in files if file.endswith(".js") or file.endswith(".cjs")])

    return js_files


def test_zeroday_task_TESTING(package: str, file: str, 
                      package_f_paths: DictProxy, 
                      io_lock: multiprocessing.Lock):
    print("{}_{}".format(package, file), flush=True)
    return "{}_{}".format(package, file)

def test_zeroday_task_TESTING_2(package: str, file: str, 
                      io_lock: multiprocessing.Lock):
    print("{}_{}".format(package, file), flush=True)

    return "{}_{}".format(package, file)


def mp_dummy_int(val: int):
    print("{}".format(val), flush=True)

    return val

def test_zeroday_task_star(args):
    return test_zeroday_task(*args)

def test_zeroday_task(package: str, file: str,  
                      io_lock: multiprocessing.Lock):
# def test_zeroday_task(package: str, file: str, 
#                       package_f_paths: DictProxy, 
#                       io_lock: multiprocessing.Lock,
#                       ws: gspread.Spreadsheet):

    io_lock.acquire()
    print(Fore.MAGENTA + f'PID {os.getpid()} - Running Explode.js for PACKAGE: {package} || FILE: {file}' + Fore.RESET)
    io_lock.release()

    #time.sleep(5)

    #return (1, 2)

    grades = {}
    explodejs_path = f"{file}_explodejs"
    taint_summary_file = os.path.join(explodejs_path, "taint_summary.json")
    norm_file = os.path.join(explodejs_path, "graph", "normalization.norm")
    symbolic_test_file = os.path.join(explodejs_path, "symbolic_test.js")

    try:
        start = time.time()
        
        f_name: str = file[file.rfind(os.path.sep) + 1:]
        neo4j_container_name: str = package + "_" + f_name
        explode_js_cmd = f"./explodejs.sh -xf {file} -p {neo4j_container_name} -c config.json -e {explodejs_path}"
        io_lock.acquire()
        print(Fore.MAGENTA + f'PID {os.getpid()} - {explode_js_cmd}' + Fore.RESET)
        io_lock.release()

        subprocess.run(explode_js_cmd, shell=True, check=True, timeout=300)
        
        #subprocess.run(f"./explodejs.sh -xf {file} -p {neo4j_container_name} -c config.json -e {explodejs_path}", shell=True, #check=True, timeout=300)
        end = time.time()
        with open(os.path.join(explodejs_path, "time.txt"), "w") as f:
            f.write(f"{end - start:.2f} seconds\n")
        check_graph_construction_zeroday(grades, norm_file)
        check_vulnerability_detection(grades, taint_summary_file)
        check_symb_test_generation(grades, symbolic_test_file, explodejs_path)
    except subprocess.TimeoutExpired:
        io_lock.acquire()
        print(Fore.MAGENTA + f'PID {os.getpid()} - subprocess.TimeoutExpired' + Fore.RESET)
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

        docker_neo4j_container: str = "neo4j-explodejs_{}".format(neo4j_container_name) 
        docker_stop_cmd = f"docker stop {docker_neo4j_container}"

        io_lock.acquire()
        print(Fore.MAGENTA + f'PID {os.getpid()} - {docker_stop_cmd}' + Fore.RESET)
        io_lock.release()
        subprocess.run(docker_stop_cmd, shell=True, check=True)
        print(Fore.RED + f"Explode.js timed out after 300 seconds!" + Fore.RESET)
    except subprocess.CalledProcessError as e:
        io_lock.acquire()
        print(Fore.MAGENTA + f'PID {os.getpid()} - subprocess.CalledProcessError' + Fore.RESET)
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

    return (package, file, grades)

    # io_lock.acquire()

    # package_f_paths[package] -= 1



    # print("Grades:", grades)
    # update_zeroday_sheet(ws, package, file, grades)

    # if package_f_paths[package] == 0:
    #     add_package_to_tested_list(package)

    # io_lock.release()

    #return grades

def test_zeroday_dataset_p(target_sheet_name: str = "ZeroDay Dataset", concurrency_level: int = 1):

    # Create worksheet if it does not exist.
    try:
        ws: gspread.Spreadsheet = load_sheet(target_sheet_name)
    except gspread.exceptions.WorksheetNotFound:
        ws = sheet.add_worksheet(target_sheet_name,"999","20")

    
    package_paths: List[str] = glob(ZERODAY_DATASET)

    # Manager to share dictionary among processes.
    multiprocessing.set_start_method("spawn")
    with multiprocessing.Manager() as manager:

        # This lock is to avoid garbled output of multiple processes.
        io_lock: multiprocessing.Lock = manager.Lock()
        
        package_f_paths: DictProxy = manager.dict()

        package_f_tuples: List[Tuple[str, str, DictProxy, multiprocessing.Lock, gspread.Spreadsheet]] = []
        
        # First we iterate the set of packages to know how many files each package has.
        for package_path in package_paths:
            package = os.path.basename(package_path)
            # Skipping those that have been tested before first.
            if check_if_package_was_tested(package):
                print(Fore.MAGENTA + f'Package "{package}" has already been tested' + Fore.RESET)
                continue
            else:
                file_paths: List[str] = get_js_files(package_path)
                package_f_paths[package] = len(file_paths)
                for f in file_paths:
                    #package_f_tuples.append((package, f, package_f_paths, io_lock, ws))
                    #package_f_tuples.append((package, f, package_f_paths, io_lock))
                    package_f_tuples.append((package, f, io_lock))
        
        # Create a process pool with the specified 'concurrency_level'.
        # Argument 'maxtasksperchild' limits how many task 'test_zeroday_task' executions
        # will occur before the process is killed and a new one is created.
        # This improves resource efficiency.
        # See: https://docs.python.org/3/library/multiprocessing.html#multiprocessing.pool.Pool
        
        
        #pool: multiprocessing.Pool = multiprocessing.pool.Pool(processes=concurrency_level, maxtasksperchild=10)
        #TODO: switch back 'processes' value to 'concurrency_level' argument 
        pool: multiprocessing.Pool = multiprocessing.pool.Pool(processes=1)


        #for result in pool.map(test_zeroday_task, package_f_tuples):
        #    pass
        #pool.map(test_zeroday_task, package_f_tuples)

        print("Concurrency: {}".format(concurrency_level))
        test_list = package_f_tuples[0:1]
        # pprint.pprint(test_list)

        # #dill.detect.badtypes(test_list)
        # pprint.pprint(dill.pickles(test_list[0][0]))
        # pprint.pprint(dill.pickles(test_list[0][1]))
        # pprint.pprint(dill.pickles(test_list[0][2]))
        # pprint.pprint(dill.pickles(test_list[0][3]))
        # pprint.pprint(dill.pickles(test_list[0][4]))

        # callback function

        def zeroday_callback(task_result):

            print("{}: callback done".format(os. getpid()), flush=True)
            print(task_result, flush=True)

            return

            grades = task_result[0]
            file = task_result[1]

            io_lock.acquire()

            package_f_paths[package] -= 1



            print("Grades:", grades)
            update_zeroday_sheet(ws, package, file, grades)

            if package_f_paths[package] == 0:
                add_package_to_tested_list(package)

            io_lock.release()

        def custom_callback(result):
            print(f'Got result: {result}')

        #chunk_sz: int = len(test_list) / concurrency_level
        # Using starmap_async to pass multiple arguments to the function.

        for result in pool.imap_unordered(test_zeroday_task_star, test_list):
            res_package = result[0]
            res_file = result[1]
            grades = result[2]
            print("{} | {}".format(res_package, res_file))
            pprint.pprint(grades)
            #print(f'Got result: {result}', flush=True)

        #result = pool.starmap_async(test_zeroday_task, test_list, callback=zeroday_callback) #.get()
        #result = pool.starmap_async(test_zeroday_task_TESTING_2, test_list, callback=custom_callback).get()

        #result = pool.map_async(test_zeroday_task_TESTING_2, test_list, callback=custom_callback).get()
        #result = pool.map_async(test_zeroday_task_TESTING_2, test_list, chunksize=chunk_sz, callback=custom_callback).get()

        ##### This dummy example below works, keep it commented forn now.
        # dummy_list = list(range(0, 10))
        # result = pool.map_async(mp_dummy_int, dummy_list, callback=custom_callback).get()
        # result.wait(timeout=5)
        # print(result)
        

        
        pool.close()
        pool.join()

    
def test_zeroday_dataset():
    ws = load_sheet("ZeroDay Dataset")
    for package_path in glob(ZERODAY_DATASET):
        package = os.path.basename(package_path)
        if not check_if_package_was_tested(package):
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
            add_package_to_tested_list(package)
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
    args = parser.parse_args()

    #pprint.pprint(args)
    #sys.exit(0)
    if args.tool == "explode.js" and args.d == "zeroday":
        #test_zeroday_dataset()
        test_zeroday_dataset_p(target_sheet_name = "ZeroDay Concurrent Test", concurrency_level = 2)
    elif args.tool == "explode.js" and ("d" not in args or args.d == "example") and not args.t:
        # clean(VULNERABLE_EXAMPLE_DATASET, args.x)
        test_explodejs(VULNERABLE_EXAMPLE_DATASET, "Example Dataset", args.u, args.x, args.l)
    elif args.tool == "explode.js" and ("d" not in args or args.d == "example") and args.t:
        # clean(VULNERABLE_EXAMPLE_DATASET, args.x)
        test_explodejs(VULNERABLE_EXAMPLE_DATASET, "Example Dataset - Test", args.u, args.x, args.l)
    

    elif args.tool == "odgen" and ("d" not in args or args.d == "example"):
        clean(VULNERABLE_EXAMPLE_DATASET, False)
        test_odgen(VULNERABLE_EXAMPLE_DATASET, "Example Dataset", args.u)
    elif args.tool == "explode.js" and args.d == "injection" and not args.t:
        # clean(INJECTION_DATASET, args.x)
        test_explodejs(INJECTION_DATASET, "Injection Dataset", args.u, args.x, args.l)
    elif args.tool == "explode.js" and args.d == "injection" and args.t:
        # clean(INJECTION_DATASET, args.x)
        test_explodejs(INJECTION_DATASET, "Injection Dataset - Test", args.u, args.x, args.l)
    elif args.tool == "odgen" and args.d == "injection":
        clean(INJECTION_DATASET, False)
        test_odgen(INJECTION_DATASET, "Injection Dataset", args.u)
    #elif args.tool == "zeroday":
    #    test_zeroday_dataset()
