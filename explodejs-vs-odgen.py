from glob import glob
import os
import shutil
from colorama import Fore
import time


PACKAGES = "/home/mikeelbyte/SysSec/empirical-jsvuln-tools-dataset/packages"
INJECTION_DATASET = "/home/mikeelbyte/SysSec/js-cpg/datasets/injection-dataset/CWE-22/*"
CWES = ("CWE-22", "CWE-78", "CWE-79", "CWE-89", "CWE-94", "CWE-471")


def cp_odgen_dir_from_packages():
    for adv_path in os.listdir(PACKAGES):
        adv_id = adv_path.split('/')[-1]
        for cwe in CWES:
            inj_dataset_adv_path = f"{INJECTION_DATASET}/{cwe}/{adv_id}"
            if os.path.exists(inj_dataset_adv_path):
                odgen_path = f"{PACKAGES}/{adv_id}/odgen/"  
                tool_output_path = f"{inj_dataset_adv_path}/tool_outputs/odgen"
                # shutil.copytree(odgen_path, tool_output_path, dirs_exist_ok=True)


def create_odgen_and_explodejs_dir():
    # for cwe in CWES:
    for adv in glob(INJECTION_DATASET):
        adv_odgen_path = f"{adv}/tool_outputs/odgen/"
        adv_explodejs_path = f"{adv}/tool_outputs/explodejs/"
        if not os.path.exists(adv_explodejs_path):
            os.makedirs(adv_explodejs_path)
            print(adv_explodejs_path)
        if not os.path.exists(adv_odgen_path):
            print(adv_odgen_path)
            os.makedirs(adv_odgen_path)


def clean_odgen_output():
    for adv in glob(INJECTION_DATASET):
        print(Fore.MAGENTA + f"Cleaning odgen results for {adv}" + Fore.RESET)
        odgen = os.path.join(adv, "tool_outputs/odgen")
        for log in os.listdir(odgen):
            os.remove(os.path.join(odgen, log))

def run_odgen():
    print(Fore.MAGENTA + f"Running Odgen for advisories in {INJECTION_DATASET}" + Fore.RESET)
    advisories = glob(INJECTION_DATASET)
    count = 1
    for adv in advisories:
        print(Fore.MAGENTA + f"{adv} ({count}/{len(advisories)})" + Fore.RESET)
        src = os.path.join(adv, "src")
        odgen = os.path.join(adv, "tool_outputs/odgen")
        start = time.time()
        for vuln_file in os.listdir(src):
            if vuln_file != "simplified.js" and "-normalized.js" not in vuln_file:
                vuln_file = os.path.join(src, vuln_file)
                # os.system(f"python3 ODGen/odgen.py -ma --timeout 30 -t os_command {vuln_file}")  
                # os.system(f"python3 ODGen/odgen.py -ma --timeout 30 -t code_exec {vuln_file}")  
                # os.system(f"python3 ODGen/odgen.py -ma --timeout 30 -t proto_pollution {vuln_file}")  
                # os.system(f"python3 ODGen/odgen.py -ma --timeout 30 -t ipt {vuln_file}")  
                # os.system(f"python3 ODGen/odgen.py -ma --timeout 30 -t path_traversal {vuln_file}")  
                # os.system(f"python3 ODGen/odgen.py -ma --timeout 30 -t xss {vuln_file}")  
        end = time.time()
        with open(os.path.join(odgen, "time.txt"), "w") as f:
            f.write(f"{end - start:.2f} seconds\n")
        logs = os.path.abspath("logs")
        for log in os.listdir(logs):
            shutil.move(os.path.join(logs, log), odgen)
        count += 1
        
def clean_explodejs_output():
    for adv in glob(INJECTION_DATASET):
        print(Fore.MAGENTA + f"Cleaning explodejs results for {adv}" + Fore.RESET)
        explodejs = os.path.join(adv, "tool_outputs/explodejs")
        for log in os.listdir(explodejs):
            os.remove(os.path.join(explodejs, log))

def run_explodejs():
    print(Fore.MAGENTA + f"Running Odgen for advisories in {INJECTION_DATASET}" + Fore.RESET)
    advisories = glob(INJECTION_DATASET)
    count = 1 
    for adv in advisories:
        print(Fore.MAGENTA + f"{adv} ({count}/{len(advisories)})" + Fore.RESET)
        src = os.path.join(adv, "src")
        explodejs = os.path.join(adv, "tool_outputs/explodejs")
        start = time.time()
        for vuln_file in os.listdir(src):
            if vuln_file != "simplified.js" and "-normalized.js" not in vuln_file:
                vuln_path = os.path.join(src, vuln_file)
                if not os.path.exists(f"{explodejs}/{vuln_file}.exjs"):
                    os.system(f"./explodejs.sh -f {vuln_path} -o {explodejs}/{vuln_file}.exjs -n {explodejs}/{vuln_file}.norm")
        end = time.time()
        if not os.path.exists(f"{explodejs}/time.txt"):
            with open(os.path.join(explodejs, "time.txt"), "w") as f:
                f.write(f"{end - start:.2f} seconds\n")
        count += 1

if __name__ == "__main__":
    run_odgen()