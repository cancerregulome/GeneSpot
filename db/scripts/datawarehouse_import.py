#!/usr/bin/env python

import argparse
import csv
import os
import pymongo
import logging
import itertools
import inspect
import json
from copy import copy
from time import time

from utilities import configure_logging
from subprocess import call

'''
Usage:
    python datawarehouse_import.py --config_file=/path/to/local/datawarehouse_import.json

Requires config_file to be passed a file containing a JSON structure similar to the following:
    {
        "databases": {
            "arbitrary_db_pointer_1": {
                "vendor": "mongodb",
                "host": "localhost",
                "port": 4321
            },
            "arbitrary_db_pointer_2": {
                "vendor": "mongodb",
                "host": "localhost",
                "port": 1234
            }
        },
        "lookups_db": "arbitrary_db_pointer_2",
        "imports": [
            {
                "tumor_type": "XYZ",
                "database": "arbitrary_db_pointer_1",
                "collections": {
                    "feature_matrix": "/path/to/local/fmx/file",
                    "mutation_summary": "/path/to/local/mut_sum/file",
                    "copy_number_gistic": "/path/to/local/cn_gistic/file",
                    "mutsig_rankings": "/path/to/local/mutsig_rankings/sig_genes.txt"
                },
                "annotations": {
                    "CNVR": "/path/to/local/fmx/annotations/cnvr_file",
                    "METH": "/path/to/local/fmx/annotations/meth_file",
                    "RPPA": "/path/to/local/fmx/annotations/rppa_file"
                }
            }
        ]
    }
'''

def execute_python(script_path, spec):
    logging.debug("(%s,%s)" % (script_path, spec))
    current_path = os.path.dirname(os.path.abspath(inspect.getfile(inspect.currentframe())))

    if not "database" in spec:
        logging.warn("NO DATABASE CONFIGURED")
        return

    db = spec["database"]
    exec_str = "python %s/%s --host=%s --port=%s --db=%s --f=%s" % (current_path, script_path, db["host"], str(db["port"]), spec["tumor_type"], spec["file"])
    logging.info("\n\t%s" % exec_str)
    return_code = call([exec_str], shell=True)

    logging.debug("%s %s" % (script_path, return_code))

def execute_javascript(script_path, spec):
    logging.debug("(%s,%s)" % (script_path, spec))

    if not "database" in spec:
        logging.warn("NO DATABASE CONFIGURED")
        return

    current_path = os.path.dirname(os.path.abspath(inspect.getfile(inspect.currentframe())))
    db = spec["database"]

    eval_expr = ""
    if "lookups_db" in spec:
        lookup_db = spec["lookups_db"]
        eval_expr = "--eval=\'var lookups_db_uri=\"%s:%s/LOOKUPS\"\'" % (lookup_db["host"], str(lookup_db["port"]))

    exec_str = "mongo --quiet --host=%s --port=%s %s %s/%s %s" % (db["host"], str(db["port"]), spec["tumor_type"], current_path, script_path, eval_expr)
    logging.info("\n\t%s" % exec_str)
    return_code = call([exec_str], shell=True)
    logging.debug("%s %s" % (script_path, return_code))

def process_import(config_json):
    config_dbs = config_json["databases"]

    for db_key in config_dbs:
        db = config_dbs[db_key]
        logging.debug("databases [%s] %s:%s:%s" % (db_key, db["vendor"], db["host"], str(db["port"])))

    for im in config_json["imports"]:
        logging.info("### STARTED:%s:%s ###" % (im["tumor_type"], im["database"]))

        db_name = im["database"]
        if db_name in config_dbs:
            db_inst = config_dbs[db_name]
            if not db_inst is None: im["database"] = db_inst
        else:
            logging.warning("unknown database [%s] [%s]" % (im["tumor_type"], db_name))
            continue

        if "lookups_db" in config_json:
            im["lookups_db"] = config_dbs[config_json["lookups_db"]]

        im_collections = im["collections"]
        if "feature_matrix" in im_collections:
            im["file"] = im_collections["feature_matrix"]
            execute_python("featurematrix_insert.py", im)
            execute_javascript("featurematrix_fill_tags.js", im)
            execute_javascript("featurematrix_fill_unid.js", im)
            execute_javascript("featurematrix_mutated_samples.js", im)
            execute_javascript("featurematrix_verify_entries.js", im)
            execute_javascript("ffn_update_fm_with_ffn_lookup.js", im)
            execute_python("ffn_add_fm_custom_labels.py", im)
            execute_javascript("generate_stats_var_lookup.js", im)

        if "mutation_summary" in im_collections:
            im["file"] = im_collections["mutation_summary"]
            execute_python("mutationsummary_insert.py", im)

        if "copy_number_gistic" in im_collections:
            im["file"] = im_collections["copy_number_gistic"]
            execute_python("copynumbergistic_insert.py", im)

        if "mutsig_rankings" in im_collections:
            im["file"] = im_collections["mutsig_rankings"]
            execute_python("mutsigrankings_insert.py", im)
            execute_javascript("mutsigrankings_top20.js", im)

        if "annotations" in im:
            im_clone = copy(im)
            im_clone_annot = im_clone["annotations"]
            if "CNVR" in im_clone_annot:
                im_clone["file"] = im_clone_annot["CNVR"]
                execute_python("featurematrix_annotate_CNVR.py", im_clone)
            if "METH" in im_clone_annot:
                im_clone["file"] = im_clone_annot["METH"]
                execute_python("featurematrix_annotate_METH.py", im_clone)
            if "RPPA" in im_clone_annot:
                im_clone["file"] = im_clone_annot["RPPA"]
                execute_python("featurematrix_annotate_RPPA.py", im_clone)

        execute_javascript("lookups_aggregate_sample_types.js", im)
        execute_javascript("lookups_aggregate_clinical_variables.js", im)
        execute_javascript("misc_aggregate_collection_fields.js", im)

        logging.info("### COMPLETED:%s ###" % im["tumor_type"])

def main():
    parser = argparse.ArgumentParser(description="Utility to import data into the Cancer Regulome Data Warehouse")
    parser.add_argument("--config_file", required=True, help="Configuration File")
    parser.add_argument("--loglevel", default="INFO", help="Logging Level")
    args = parser.parse_args()

    configure_logging(args.loglevel.upper())

    startAt = time()
    logging.info("\n------------------\nSTART\n------------------")

    logging.debug("config_file: %s" % args.config_file)
    process_import(json.load(open(args.config_file)))

    endAt = time()
    durAt = round(endAt - startAt, 3)
    logging.info("\n------------------\nCOMPLETED in %s sec(s)\n------------------" % str(durAt))

if __name__ == "__main__":
    main()
