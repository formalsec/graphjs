import gspread
import re
from glob import glob
import os
import json
from colorama import Fore
import time
import argparse
import ast

# Default datasets
VULNERABLE_EXAMPLE_DATASET = "datasets/example-dataset/vulnerable/ipt/*"
INJECTION_DATASET = "./datasets/injection-dataset/CWE-471/GHSA-23wx-cgxq-vpwx"

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
                    os.remove(file_path)


def test_odgen(dataset_path, dataset, update_sheets):
    print(Fore.MAGENTA + f"Running ODGen for vulnerabilities in {dataset_path}" + Fore.RESET)


def test_explodejs(dataset_path, dataset, update_sheets, exploit):
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
            "./datasets/injection-dataset/CWE-78/694", 
            "./datasets/injection-dataset/CWE-94/97", 
            "./datasets/injection-dataset/CWE-94/GHSA-7fm6-gxqg-2pwr",
            "./datasets/injection-dataset/CWE-471/577",
            "./datasets/injection-dataset/CWE-471/1065",
            "./datasets/injection-dataset/CWE-471/GHSA-8g4m-cjm2-96wq",
        ]
        if vulnerability_path in time_limit_exceeded or vulnerability_path in excluded:
            continue

        explodejs_path = os.path.join(vulnerability_path, "tool_outputs/explodejs")
        if not os.path.exists(explodejs_path):
            os.mkdir(explodejs_path)

        if dataset == "Injection Dataset":
            vulnerability_path = os.path.join(vulnerability_path, "src")

        start = time.time()
        grades = {}
        for vulnerable_file in os.listdir(vulnerability_path):
            if (vulnerable_file.endswith(".js") or vulnerable_file.endswith(".cjs")) \
            and "-normalized.js" not in vulnerable_file and "simplified.js" not in vulnerable_file:
                vulnerable_file_path = os.path.join(vulnerability_path, vulnerable_file)
                taint_summary_file = os.path.join(explodejs_path, f"{vulnerable_file}_taint_summary.json")
                norm_file = os.path.join(explodejs_path, f"{vulnerable_file}.norm")
                expected_output_file = os.path.join(explodejs_path, f"{vulnerable_file}_expected_output.json")
                symbolic_test_file = os.path.join(explodejs_path, f"{vulnerable_file}_symbolic_test.js")
                if not exploit:
                    os.system(f"./explodejs.sh -f {vulnerable_file_path} -c config.json -o {taint_summary_file} -n {norm_file}")
                else:
                    os.system(f"./explodejs.sh -xf {vulnerable_file_path} -c config.json -o {taint_summary_file} -t {symbolic_test_file} -n {norm_file}")
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
    if dataset == "Example Dataset":
        vulnerable_file = "/".join(vulnerable_file.split("/")[2:])
        cell = ws.find(vulnerable_file)
        ws.update_cell(cell.row, cell.col + 1, grades.get("graph_construction", "NaN"))
        ws.update_cell(cell.row, cell.col + 2, grades.get("detection", "NaN"))
        ws.update_cell(cell.row, cell.col + 3, grades.get("data_reconstruction", "NaN"))
        ws.update_cell(cell.row, cell.col + 4, grades.get("symb_test", "NaN"))
        ws.update_cell(cell.row, cell.col + 5, grades.get("confirmation", "NaN"))
    elif dataset == "Injection Dataset":
        vulnerable_file = vulnerable_file.split("/")[-2]
        cell = ws.find(vulnerable_file, in_column=1) 
        ws.update_cell(cell.row, cell.col + 2, grades.get("graph_construction", "NaN"))
        ws.update_cell(cell.row, cell.col + 3, grades.get("detection", "NaN"))
        ws.update_cell(cell.row, cell.col + 4, grades.get("data_reconstruction", "NaN"))
        ws.update_cell(cell.row, cell.col + 5, grades.get("symb_test", "NaN"))
        ws.update_cell(cell.row, cell.col + 6, grades.get("confirmation", "NaN"))
    else:
        print(Fore.RED + "The given dataset is not present in the sheet" + Fore.RESET)
        return
    


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("tool", choices=["explode.js", "odgen"], 
                        help="Which tool should be tested?")
    parser.add_argument("-d", type=str, default="example",
                        help="What dataset should be tested?")
    parser.add_argument("-u", action="store_true",
                        help="Update google sheets?")
    parser.add_argument("-x", action="store_true",
                        help="Update google sheets?")
    args = parser.parse_args()

    if args.tool == "explode.js" and ("d" not in args or args.d == "example"):
        clean(VULNERABLE_EXAMPLE_DATASET, args.x)
        test_explodejs(VULNERABLE_EXAMPLE_DATASET, "Example Dataset", args.u, args.x)
    elif args.tool == "odgen" and ("d" not in args or args.d == "example"):
        clean(VULNERABLE_EXAMPLE_DATASET, False)
        test_odgen(VULNERABLE_EXAMPLE_DATASET, "Example Dataset", args.u)
    elif args.tool == "explode.js" and args.d == "injection":
        clean(INJECTION_DATASET, args.x)
        test_explodejs(INJECTION_DATASET, "Injection Dataset", args.u, args.x)
    elif args.tool == "odgen" and args.d == "injection":
        clean(INJECTION_DATASET, False)
        test_odgen(INJECTION_DATASET, "Injection Dataset", args.u)
