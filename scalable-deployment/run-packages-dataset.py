import gspread
import re
from glob import glob
import os
import json
from colorama import Fore
import time
import argparse

# Default datasets
PACKAGES_SRC = "datasets/package-dataset/packages-src/*"

# Google Sheets Config
service_account = gspread.service_account(filename="../.config/service_account.json")
sheet = service_account.open("explode.js-vs-odgen")


def clean(dataset):
    for vulnerability in glob(dataset):
        print(Fore.MAGENTA + f"Cleaning explodejs results for {vulnerability}" + Fore.RESET)
        explodejs = os.path.join(vulnerability, "tool_outputs/explodejs")
        if "aux-files" in vulnerability:
            continue

        if not os.path.exists(explodejs):
            os.makedirs(explodejs)
        else:
            for file_name in os.listdir(explodejs):
                if "expected_output.json" not in file_name:
                    file_path = os.path.join(explodejs, file_name)
                    os.remove(file_path)


def check_filetype(f):
    return f.endswith(".js") or f.endswith(".cjs")


def test_explodejs(dataset_path, dataset, update_sheets):
    print(Fore.MAGENTA + f"Running Explode.js for vulnerabilities in {dataset_path}" + Fore.RESET)
    vulnerabilities = glob(dataset_path)
    count = 1
    ws = load_sheet(dataset)
    for vulnerability_path in vulnerabilities:
        if "aux-files" in vulnerability_path:
            continue

        print(Fore.MAGENTA + f"{vulnerability_path} ({count}/{len(vulnerabilities)})" + Fore.RESET)

        explodejs_path = os.path.join(vulnerability_path, "tool_outputs/explodejs")
        if not os.path.exists(explodejs_path):
            os.makedirs(explodejs_path)

        files_count = 1
        start = time.time()
        # for root, dirs, files in os.walk(vulnerability_path, topdown=False):
        files = glob(f'{vulnerability_path}/**/*', recursive=True)
        js_files = list(filter(check_filetype, files))
        final_grades = {
            'total_files': len(js_files),
            'graph_construction': {},
            'detection': 0
        }
        grades = {}
        for vulnerable_file in js_files:
            vulnerable_file_path = os.path.abspath(vulnerable_file)
            vulnerable_file_name = os.path.basename(vulnerable_file_path)

            print(Fore.MAGENTA + f"\t[FILE] {vulnerable_file_name} ({files_count}/{len(js_files)})" + Fore.RESET)

            output_file = os.path.join(explodejs_path, f"{vulnerable_file_name}_taint_summary.json")
            norm_file = os.path.join(explodejs_path, f"{vulnerable_file_name}.norm")
            # expected_output_file = os.path.join(explodejs_path, f"{vulnerable_file_name}_expected_output.json")

            os.system(f"./explodejs-2.sh -f {vulnerable_file_path} -c config.json -o {output_file} -n {norm_file} >/dev/null 2>&1")
            # os.system(f"./explodejs-2.sh -f {vulnerable_file_path} -c config.json -o {output_file} -n {norm_file} -g >/dev/null 2>&1")
            check_graph_construction(grades, norm_file)
            evaluate_outputs(grades, norm_file, output_file)
            # print("Intermdiate grades:", grades)
            files_count += 1

        # package,
        # nr Construction A, nr C, nr D,
        # nr Detection
        final_grades['graph_construction']['A'] = 0
        final_grades['graph_construction']['C'] = 0
        final_grades['graph_construction']['D'] = 0
        for file in grades:
            construction = grades[file]['graph_construction']
            final_grades['graph_construction'][construction] += 1
            final_grades['detection'] += grades[file]['detection']

        if update_sheets: update_sheet(ws, dataset, vulnerability_path, final_grades)

        end = time.time()
        with open(os.path.join(explodejs_path, "time.txt"), "w") as f:
            f.write(f"{end - start:.2f} seconds\n")
        count += 1


def check_graph_construction(grades, norm_file):
    grades[norm_file] = {}
    with open(norm_file, "r") as f:
        file_content = f.read()
        regex = re.compile(r'Error: [A-Za-z]*Error')
        if regex.search(file_content):
            grades[norm_file]["graph_construction"] = chr(max(ord(grades[norm_file].get("graph_construction", "0")), ord("D")))
        elif "Trace: Expression" in file_content:
            grades[norm_file]["graph_construction"] = chr(max(ord(grades[norm_file].get("graph_construction", "0")), ord("C")))
        else:
            grades[norm_file]["graph_construction"] = chr(max(ord(grades[norm_file].get("graph_construction", "0")), ord("A")))


def evaluate_outputs(grades, norm_file, output):
    grades[norm_file]["detection"] = 0
    try:
        out = json.load(open(output))
    except FileNotFoundError:
        print("Output file does not exist!")
        return

    if len(out) > 0:
        print(f"Detected {len(out)} vulnerabilities!")

    grades[norm_file]["detection"] = len(out)

    return grades


def load_sheet(sheet_name):
    return sheet.worksheet(sheet_name)


def update_sheet(ws, dataset, vulnerable_path, grades):
    if dataset == "Packages Dataset":
        package = '-'.join(vulnerable_path.split('/')[-1].split('-')[0:-1])
        construction = grades.get("graph_construction")
        print(Fore.MAGENTA + f"Updating {package} with:" + Fore.RESET)
        print(Fore.MAGENTA + f'\tTotal files {grades.get("total_files", "NaN")}' + Fore.RESET)
        print(Fore.MAGENTA + f'\tA {construction.get("A", "NaN")}' + Fore.RESET)
        print(Fore.MAGENTA + f'\tC {construction.get("C", "NaN")}' + Fore.RESET)
        print(Fore.MAGENTA + f'\tD {construction.get("D", "NaN")}' + Fore.RESET)
        cell = ws.find(package)
        ws.update_cell(cell.row, cell.col + 1, grades.get("total_files", "NaN"))
        ws.update_cell(cell.row, cell.col + 2, construction.get("A", "NaN"))
        ws.update_cell(cell.row, cell.col + 3, construction.get("C", "NaN"))
        ws.update_cell(cell.row, cell.col + 4, construction.get("D", "NaN"))
        ws.update_cell(cell.row, cell.col + 5, grades.get("detection", "NaN"))
        # ws.update_cell(cell.row, cell.col + 3, grades.get("data_reconstruction", "NaN"))
        # ws.update_cell(cell.row, cell.col + 4, grades.get("confirmation", "NaN"))

    else:
        print(Fore.RED + "The given dataset is not present in the sheet" + Fore.RESET)
        return


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("-u", action="store_true",
                        help="Update google sheets?")
    args = parser.parse_args()

    clean(PACKAGES_SRC)
    test_explodejs(PACKAGES_SRC, "Packages Dataset", args.u)
