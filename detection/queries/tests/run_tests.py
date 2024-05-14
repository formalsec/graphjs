import unittest
import subprocess
import os
import sys
import json

graphjs_path = os.path.abspath('../../../')
graphjs = os.path.join(graphjs_path, 'graphjs.py')
sys.path.append(graphjs_path)


def compare_call_paths(self, call_path1, call_path2):
    if len(call_path1) != len(call_path2):
        return False
    for call1, call2 in zip(call_path1, call_path2):
        if not call1["type"] == call2["type"] or not call1["fn_name"] in call2["fn_name"]:
            return False
    return True


# TODO: Check for all vulnerabilities
def check_call_paths(self, expected_output_file, test_output_file):
    with open(expected_output_file, "r") as f1:
        expected_output = json.load(f1)
        with open(test_output_file, "r") as f2:
            test_output = json.load(f2)
            test_call_path = test_output[0]["call_paths"]  # For now, only one vulnerability
            expected_call_path = expected_output[0]["call_paths"]  # For now, only one vulnerability
            correct_call_paths = 0
            for expected_call in expected_call_path:
                for result_call in test_call_path:
                    if compare_call_paths(self, expected_call, result_call):
                        correct_call_paths += 1
            self.assertEqual(len(expected_call_path), correct_call_paths)


def run_graphjs(test_filename, output_dir):
    run_command = ["python3", graphjs, "-f", test_filename, "-e", "-o", output_dir]
    subprocess.run(run_command)


class TestCallPath(unittest.TestCase):

    def test_exported_call(self):
        run_graphjs("test_cases/example-1/test.js", "./output/example-1")
        check_call_paths(self, "test_cases/example-1/expected_output.json", "./output/example-1/taint_summary.json")

    def test_simple_call(self):
        run_graphjs("test_cases/example-2/test.js", "./output/example-2")
        check_call_paths(self, "test_cases/example-2/expected_output.json", "./output/example-2/taint_summary.json")

    def test_double_call(self):
        run_graphjs("test_cases/example-3/test.js", "./output/example-3")
        check_call_paths(self, "test_cases/example-3/expected_output.json", "./output/example-3/taint_summary.json")

    def test_triple_call(self):
        run_graphjs("test_cases/example-4/test.js", "./output/example-4")
        check_call_paths(self, "test_cases/example-4/expected_output.json", "./output/example-4/taint_summary.json")

    def test_double_method_call(self):
        run_graphjs("test_cases/example-5/test.js", "./output/example-5")
        check_call_paths(self, "test_cases/example-5/expected_output.json", "./output/example-5/taint_summary.json")

    def test_triple_method_call(self):
        run_graphjs("test_cases/example-6/test.js", "./output/example-6")
        check_call_paths(self, "test_cases/example-6/expected_output.json", "./output/example-6/taint_summary.json")

    def test_double_inner_method_call(self):
        run_graphjs("test_cases/example-7/test.js", "./output/example-7")
        check_call_paths(self, "test_cases/example-7/expected_output.json", "./output/example-7/taint_summary.json")

    def test_simple_method_call(self):
        run_graphjs("test_cases/example-8/test.js", "./output/example-8")
        check_call_paths(self, "test_cases/example-8/expected_output.json", "./output/example-8/taint_summary.json")

    def test_double_outer_method_call(self):
        run_graphjs("test_cases/example-9/test.js", "./output/example-9")
        check_call_paths(self, "test_cases/example-9/expected_output.json", "./output/example-9/taint_summary.json")

    def test_simple_proto_call(self):
        run_graphjs("test_cases/example-10/test.js", "./output/example-10")
        check_call_paths(self, "test_cases/example-10/expected_output.json", "./output/example-10/taint_summary.json")

    def test_simple_class_call(self):
        run_graphjs("test_cases/example-11/test.js", "./output/example-11")
        check_call_paths(self, "test_cases/example-11/expected_output.json", "./output/example-11/taint_summary.json")

    def test_double_class_call(self):
        run_graphjs("test_cases/example-12/test.js", "./output/example-12")
        check_call_paths(self, "test_cases/example-12/expected_output.json", "./output/example-12/taint_summary.json")

    def test_simple_top_level_call(self):
        run_graphjs("test_cases/example-13/test.js", "./output/example-13")
        check_call_paths(self, "test_cases/example-13/expected_output.json", "./output/example-13/taint_summary.json")

    def test_simple_promise_call(self):
        run_graphjs("test_cases/example-14/test.js", "./output/example-14")

    def test_property_export(self):
        run_graphjs("test_cases/example-15/test.js", "./output/example-15")

    def test_exports_module(self):
        run_graphjs("test_cases/example-16/test.js", "./output/example-16")

if __name__ == '__main__':
    unittest.main()
