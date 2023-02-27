import gspread
import re
from glob import glob
import os
import json
from colorama import Fore
import time
import argparse

# Default datasets
VULNERABLE_EXAMPLE_DATASET = "datasets/example-dataset/vulnerable/injection/*"
INJECTION_DATASET = "datasets/injection-dataset/*/*"

# Google Sheets Config
service_account = gspread.service_account(filename=".config/service_account.json")
sheet = service_account.open("explode.js-vs-odgen")


def clean(dataset):
    for vulnerability in glob(dataset):
        print(Fore.MAGENTA + f"Cleaning explodejs results for {vulnerability}" + Fore.RESET)
        explodejs = os.path.join(vulnerability, "tool_outputs/explodejs")
        for file_name in os.listdir(explodejs):
            if file_name != "expected_output.json":
                file_path = os.path.join(explodejs, file_name)
                os.remove(file_path)


def test_odgen(dataset):
    print(Fore.MAGENTA + f"Running ODGen for vulnerabilities in {dataset}" + Fore.RESET)


def test_explodejs(dataset_path, dataset, update_sheets):
    print(Fore.MAGENTA + f"Running Explode.js for vulnerabilities in {dataset_path}" + Fore.RESET)
    vulnerabilities = glob(dataset_path)
    count = 1 
    ws = load_sheet(dataset)
    for vulnerability_path in vulnerabilities:
        print(Fore.MAGENTA + f"{vulnerability_path} ({count}/{len(vulnerabilities)})" + Fore.RESET)
            
        explodejs_path = os.path.join(vulnerability_path, "tool_outputs/explodejs")
        if not os.path.exists(explodejs_path):
            os.mkdir(explodejs_path)
        start = time.time()
        for vulnerable_file in os.listdir(vulnerability_path):
            if vulnerable_file.endswith(".js") and "-normalized.js" not in vulnerable_file:
                vulnerable_file_path = os.path.join(vulnerability_path, vulnerable_file)
                output_file = os.path.join(explodejs_path, f"{vulnerable_file}_taint_summary.json")
                os.system(f"./explodejs.sh -f {vulnerable_file_path} -c detection/config.json -o {output_file} -n {explodejs_path}/{vulnerable_file}.norm")
                if update_sheets:
                    grades = compare_outputs(os.path.join(explodejs_path, "expected_output.json"), output_file)
                    update_sheet(ws, dataset, vulnerability_path, grades)
        end = time.time()
        with open(os.path.join(explodejs_path, "time.txt"), "w") as f:
            f.write(f"{end - start:.2f} seconds\n")
        count += 1


def compare_outputs(expected_output, output):
    grades = {}
    expected = json.load(open(expected_output))
    out = json.load(open(output))

    num_vulns = len(expected)
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
                if ex_vuln["params_types"] == o["params_types"]:
                    reconstructed_data += 1

    detection_rate = detected_vulns / num_vulns 
    if detection_rate == 1:
        grades["detection"] = "A"
    elif 0.5 <= detection_rate < 1:
        grades["detection"] = "B"
    elif 0 < detection_rate < 0.5:
        grades["detection"] = "C"
    else:
        grades["detection"] = "D"

    reconstruction_rate = reconstructed_data / num_vulns 
    if reconstruction_rate == 1:
        grades["data_reconstruction"] = "A"
    elif 0.5 <= reconstruction_rate < 1:
        grades["data_reconstruction"] = "B"
    elif 0 < reconstruction_rate < 0.5:
        grades["data_reconstruction"] = "C"
    else:
        grades["data_reconstruction"] = "D"

    print("GRADES:", grades)

    return grades


def load_sheet(sheet_name):
    return sheet.worksheet(sheet_name)


def update_sheet(ws, dataset, vulnerable_file, grades):
    if dataset == "Example Dataset":
        vulnerable_file = "/".join(vulnerable_file.split("/")[2:])
    elif dataset == "Injection Dataset":
        pass
    else:
        print(Fore.RED + "The given dataset is not present in the sheet" + Fore.RESET)
        return
    
    cell = ws.find(vulnerable_file)
    ws.update_cell(cell.row, cell.col + 1, grades.get("detection", "NaN"))
    ws.update_cell(cell.row, cell.col + 2, grades.get("data_reconstruction", "NaN"))
    ws.update_cell(cell.row, cell.col + 3, grades.get("confirmation", "NaN"))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("tool", choices=["explode.js", "odgen"], 
                        help="Which tool should be tested?")
    parser.add_argument("-d", type=str, default="example",
                        help="What dataset should be tested?")
    parser.add_argument("-u", action="store_true",
                        help="Update google sheets?")
    args = parser.parse_args()

    if args.tool == "explode.js" and ("d" not in args or args.d == "example"):
        clean(VULNERABLE_EXAMPLE_DATASET)
        test_explodejs(VULNERABLE_EXAMPLE_DATASET, "Example Dataset", args.u)
    elif args.tool == "odgen" and ("d" not in args or args.d == "example"):
        clean(VULNERABLE_EXAMPLE_DATASET)
        test_odgen(VULNERABLE_EXAMPLE_DATASET, "Example Dataset", args.u)
    elif args.tool == "explode.js" and args.d == "injection":
        clean(INJECTION_DATASET)
        test_explodejs(INJECTION_DATASET, "Injection Dataset", args.u)
    elif args.tool == "odgen" and args.d == "injection":
        clean(INJECTION_DATASET)
        test_odgen(INJECTION_DATASET, "Injection Dataset", args.u)