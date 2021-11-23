import graphviz
import csv
import argparse
import os

def get_edge_color(e_label):
    color = 'black'

    if e_label == 'AST_parentOf':
        color = 'blue'
    elif e_label == 'CFG_parentOf':
        color = 'red'
    elif e_label == 'PDG_parentOf' or e_label == 'PDG_control':
        color = 'darkgreen'

    return color


def get_csv_content(csv_file):
    with open(csv_file, mode='r') as csv_f:
        reader = csv.reader(csv_f, delimiter=';')
        return list(reader)


def convert_graph(directory, output_file):
    dot = graphviz.Digraph(format='png')

    # [Id:ID; Type; Kind; Code; Range; Location; Value; Raw; Async; Label:LABEL; SemanticType]
    for row in get_csv_content(os.path.join(directory, "nodes.csv"))[1:]:
        print(row)
        n_id = row[0]
        n_label = row[9]
        n_type = row[1]

        if n_type == "Identifier":
            n_type = row[3]
        
        dot.node(n_id, label=n_type, fontcolor='blue', color='blue')

    # [FromId:START_ID; ToId:END_ID; RelationLabel:TYPE; RelationType; Arguments]
    for row in get_csv_content(os.path.join(directory, "rels.csv"))[1:]:
        e_start = row[0]
        e_end = row[1]
        e_label = row[2]
        color = get_edge_color(e_label)
        e_type = row[3]
        dot.edge(e_start, e_end, label=e_type, fontcolor=color, color=color)

    dot.render(filename=output_file, directory=directory, format='png')


def main():
    parser = argparse.ArgumentParser(description="Convert csv graph format to dot format.")
    parser.add_argument("directory", help="The directory that includes the nodes.csv and rels.csv files")
    parser.add_argument("outfile", help="Filename for the png file with the output. It will be created inside \"directory\"")
    
    args = parser.parse_args()
    directory = os.path.abspath(args.directory)
    graph_file = args.outfile

    convert_graph(directory, graph_file)

main()