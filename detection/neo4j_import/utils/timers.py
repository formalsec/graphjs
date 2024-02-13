import time


def start_timer():
    return time.perf_counter_ns()


def stop_timer(start_time, type, output_file):
    elapsed_time = (time.perf_counter_ns() - start_time) / 1000000  # to ms
    print(f'{type}: {elapsed_time}', file=open(output_file, 'a'))  # output to file
