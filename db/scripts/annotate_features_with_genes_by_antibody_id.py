#!/usr/bin/env python

import argparse
import csv
import os
import pymongo
import logging
import itertools

from utilities import configure_logging
from annotate_features_with_genes import append_genes

# this script parses antibody annotations files produced by TCGA
# it uses (column 3) for antibody ID and (column 1) for gene names
# and annotates a mongo (NOSQL) database with the matching 'antibody' in the feature_matrix collection
#
# feature matrix file (to
# example antibody annotations data:
# Gene Name       Array data file names   Composite Element REF
# YWHAB   14-3-3_beta-R-V_GBL9029762      14-3-3_beta
# YWHAE   14-3-3_epsilon-M-C_GBL9029920   14-3-3_epsilon
# YWHAZ   14-3-3_zeta-R-V_GBL9029763      14-3-3_zeta
# EIF4EBP1        4E-BP1-R-V_GBL9029764   4E-BP1
# EIF4EBP1        4E-BP1_pS65-R-V_GBL9029766      4E-BP1_pS65
# EIF4EBP1        4E-BP1_pT37_T46-R-V_GBL9029765  4E-BP1_pT37_T46
# EIF4EBP1        4E-BP1_pT70-R-V_GBL9029970      4E-BP1_pT70
# AKT1 AKT2 AKT3  Akt-R-V_GBL9029961      Akt
# AKT1 AKT2 AKT3  Akt_pS473-R-V_GBL9029772        Akt_pS473
# AKT1 AKT2 AKT3  Akt_pT308-R-V_GBL9029773        Akt_pT308
#
# example RPPA feature IDs:
# N:RPPA:YWHAB:chr20:43514317:43537173:+:14-3-3_beta
# N:RPPA:YWHAE:chr17:1247566:1303672:-:14-3-3_epsilon
# N:RPPA:YWHAZ:chr8:101928753:101965616:-:14-3-3_zeta
# N:RPPA:EIF4EBP1:chr8:37887859:37917883:+:4E-BP1
# N:RPPA:EIF4EBP1:chr8:37887859:37917883:+:4E-BP1_pS65
# N:RPPA:EIF4EBP1:chr8:37887859:37917883:+:4E-BP1_pT37_T46

def extract_rows_by_id(filename):
    with open(filename, "rb") as csvfile:
        csvreader = csv.reader(csvfile, delimiter="\t")
        csvreader.next()

        r_by_id = {}
        for row in csvreader:
            r_by_id[row[2]] = row[0].split(" ")
        return r_by_id

def find_and_modify(collection, rows_by_id):
    count = 0
    for id in rows_by_id:
        row = rows_by_id[id]
        agg_genes = []
        append_genes(rows_by_id[id], agg_genes)
        cnt = collection.find({ "antibody": id }).count()
        if cnt == 1:
            collection.find_and_modify({ "antibody": id }, { "$set":{ "genes": agg_genes }}, upsert=True)
            logging.debug("find_and_modify [%s] [%s]===%s" % (count, id, agg_genes))
        count += 1
        if count % 100 == 0: logging.info("upsert [%s]" % count)

    logging.info("total find_and_modify count=%s" % count)

def main():
    parser = argparse.ArgumentParser(description="Utility to annotate features with antibody IDs (i.e. RPPA) to genes based on annotations file")
    parser.add_argument("--host", required=True, help="MongoDB host name")
    parser.add_argument("--port", required=True, type=int, help="MongoDB port")
    parser.add_argument("--db", required=True, help="Database name")
    parser.add_argument("--f", required=True, help="Antibody annotations file")
    parser.add_argument("--loglevel", default="INFO", help="Logging Level")
    args = parser.parse_args()

    configure_logging(args.loglevel.upper())

    logging.info("import file: %s" % args.f)
    logging.info("uploading to %s:%s/%s" % (args.host, args.port, args.db))

    conn = pymongo.Connection(args.host, args.port)
    db = conn[args.db]

    # Extraction Phase
    rows_by_id = extract_rows_by_id(args.f)

    # Database Load Phase
    find_and_modify(db["feature_matrix"], rows_by_id)
    conn.close()

if __name__ == "__main__":
    main()