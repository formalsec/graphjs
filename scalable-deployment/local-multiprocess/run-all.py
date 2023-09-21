import gspread
import re
from glob import glob
import os
import json
from colorama import Fore
import time
import argparse
from multiprocessing import Process, Pool, Queue, cpu_count
from multiprocessing.sharedctypes import Value


# Google Sheets Config
service_account = gspread.service_account(filename=os.path.realpath("../../.config/service_account.json"))
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
    return f.endswith(".js")# or f.endswith(".cjs")

# Multiprocess variables
PROCESS_NUMBER = 4
queue_results = Queue()
queue_analyzed = Queue()
files_count = Value('i', 1)
total_files = Value('i', 0)
analyzed_files = []


def write_analyzed_file_task(analyzed_files):
    with open(ANALYZED_FILES, "a+") as af:
        while True:
            file = queue_analyzed.get()

            if file == None:
                print(Fore.GREEN + "Analyzed Files Queue returned None" + Fore.RESET, flush=True)
                break

            if not file in analyzed_files:
                af.write(file + "\n")
                af.flush()


def write_result_task():
    while True:
        result = queue_results.get()

        if result == None:
            print(Fore.YELLOW + "Results Queue is empty" + Fore.RESET, flush=True)
            break

        print(result, flush=True)

        with open(RESULTS_FILE, "a+") as rw:
            print(Fore.YELLOW + "Writing to file" + Fore.RESET, flush=True)
            rw.write(f"{result.get('package')}, {result.get('vulnerable_file_path')}, {result.get('norm_file')}, {result.get('graph_construction')}, {result.get('detection')}\n")
            rw.flush()



def explodejs_execution(item):
        global files_count, total_files, analyzed_files

        vulnerable_file = item[0]
        explodejs_path = item[1]
        package_dir = item[2]

        vulnerable_file_path = os.path.abspath(vulnerable_file)
        vulnerable_file_name = os.path.basename(vulnerable_file_path)

        print(Fore.MAGENTA + f"\t[FILE] {vulnerable_file_path} ({files_count.value}/{total_files.value})" + Fore.RESET, flush=True)
        with files_count.get_lock():
            files_count.value += 1

        # do not process files previously analyzed
        if not vulnerable_file_path in analyzed_files:
            # Add this file to analyzed file's local file cache
            queue_analyzed.put(vulnerable_file_path)

            output_file = os.path.join(explodejs_path, f"{vulnerable_file_name}_taint_summary.json")
            norm_file = os.path.join(explodejs_path, f"{vulnerable_file_name}.norm")

            os.system(f"./explodejs-local-multi.sh -f {vulnerable_file_path} -c ../../detection/config.json -o {output_file} -n {norm_file} >/dev/null 2>&1")
            grades = { "package": package_dir }
            check_graph_construction(grades, norm_file, vulnerable_file_path)
            vulnerable = evaluate_outputs(grades, output_file)
            if vulnerable:
                queue_results.put(grades)

        if files_count.value == total_files.value:
            queue_analyzed.put(None)
            queue_results.put(None)


def test_explodejs(dataset_path, dataset, update_sheets, analyzed_files):
    start = time.time()
    # print(Fore.MAGENTA + f"Running Explode.js for vulnerabilities in {dataset_path}" + Fore.RESET)
    vulnerabilities = glob(dataset_path)

    # ws = load_sheet(dataset)
    js_files_all = []

    # fill multiprocessing queue
    for vulnerability_path in vulnerabilities:
        if "aux-files" in vulnerability_path:
            continue

        package_dir = os.path.basename(vulnerability_path)
        explodejs_path = os.path.join(vulnerability_path, "tool_outputs/explodejs")
        if not os.path.exists(explodejs_path):
            os.makedirs(explodejs_path)

        files = glob(f'{vulnerability_path}/**/*', recursive=True)
        js_files = list(filter(check_filetype, files))
        [ js_files_all.append([jf, explodejs_path, package_dir]) for jf in js_files ]

    af_process = Process(target=write_analyzed_file_task, args=(analyzed_files,))
    af_process.start()

    rw_process = Process(target=write_result_task)
    rw_process.start()

    global total_files
    total_files.value = len(js_files_all)
    with Pool(cpu_count() - 1) as pool:
        pool.map(explodejs_execution, js_files_all)

    af_process.join()
    rw_process.join()

    end = time.time()
    with open("time.txt", "w") as f:
        f.write(f"{end - start:.2f} seconds\n")



def check_graph_construction(grades, norm_file, vulnerable_file_path):
    grades["norm_file"] = norm_file
    grades["vulnerable_file_path"] = vulnerable_file_path
    with open(norm_file, "r") as f:
        file_content = f.read()
        regex = re.compile(r'Error: [A-Za-z]*Error')
        if regex.search(file_content):
            grades["graph_construction"] = chr(max(ord(grades.get("graph_construction", "0")), ord("D")))
        elif "Trace: Expression" in file_content:
            grades["graph_construction"] = chr(max(ord(grades.get("graph_construction", "0")), ord("C")))
        else:
            grades["graph_construction"] = chr(max(ord(grades.get("graph_construction", "0")), ord("A")))


def evaluate_outputs(grades, output):
    grades["detection"] = 0
    try:
        out = json.load(open(output))
    except FileNotFoundError:
        print("Output file does not exist!")
        return

    if len(out) > 0:
        print(f"Detected {len(out)} vulnerabilities!")

    grades["detection"] = len(out)

    return len(out) > 0


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


# Default datasets
PACKAGES_SRC = os.path.realpath("../../datasets/package-dataset/packages-src/*")
ANALYZED_FILES = os.path.realpath("./analyzed_files.txt")
RESULTS_FILE = os.path.realpath("./results_file.csv")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("-u", action="store_true",
                        help="Update google sheets?")
    args = parser.parse_args()

    clean(PACKAGES_SRC)

    if not os.path.exists(ANALYZED_FILES):
        af = open(ANALYZED_FILES, "w+")
        af.close()

    with open(ANALYZED_FILES, "r+") as af:
        analyzed_files = [ f.strip() for f in af.readlines() ]

    if not os.path.exists(RESULTS_FILE):
        rw = open(RESULTS_FILE, "w+")
        rw.write("package, vulnerable_file_path, norm_file, graph_construction, detection\n")
        rw.close()

    test_explodejs(PACKAGES_SRC, "Packages Dataset", args.u, analyzed_files)
