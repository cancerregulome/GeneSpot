#!/usr/bin/env python

import argparse
import csv
import os
import pymongo
import logging
import itertools

from utilities import configure_logging
from featurematrix_annotate_CNVR import collect_tags

# this script parses antibody annotations files produced by TCGA
# it uses (column 3) for antibody ID and (column 1) for gene names
# and annotates a mongo (NOSQL) database with the matching 'antibody' in the feature_matrix collection
#
# feature matrix file (to example antibody annotations data):
# IlmnID	CHR	MAPINFO	UCSC_RefGene_Name	UCSC_RefGene_Accession	UCSC_RefGene_Group	UCSC_CpG_Islands_Name	Relation_to_UCSC_CpG_Island
# cg00035864	Y	8553009	TTTY18	NR_001550	TSS1500
# cg00050873	Y	9363356	TSPY4;FAM197Y2	NM_001164471;NR_001553	Body;TSS1500	chrY:9363680-9363943	N_Shore
# cg00061679	Y	25314171	DAZ1;DAZ4;DAZ4	NM_004081;NM_020420;NM_001005375	Body;Body;Body
# cg00063477	Y	22741795	EIF1AY	NM_004681	Body	chrY:22737825-22738052	S_Shelf
# cg00121626	Y	21664296	BCORL2	NR_002923	Body	chrY:21664481-21665063	N_Shore
# cg00212031	Y	21239348	TTTY14	NR_001543	TSS200	chrY:21238448-21240005	Island
#
# example METH feature IDs:
# N:METH:NFYC:chr1:41218983:::cg07387734_Body
# N:METH:ATP2A1:chr16:28890100:::cg00000292_1stExon_NShore
# N:METH:SLMAP:chr3:57743543:::cg00002426_1stExon_SShore
# N:METH:SND1:chr7:127721794:::cg00002531_Body
# N:METH:MEOX2:chr7:15725862:::cg00003994_1stExon
# N:METH:HOXD3:chr2:177029073:::cg00005847_5pUTR_NShore
# N:METH:COX8C:chr14:93813777:::cg00008493_Body_Island
# N:METH:IMPA2:chr18:11980953:::cg00008713_TSS1500_Island
# N:METH:MIR1178:chr12:120151890:::cg00009001_TSS1500
# N:METH:TMEM186:chr16:8890425:::cg00011459_Body_NShore
# N:METH:ANG:chr14:21151024:::cg00012199_TSS1500_Island

def extract_tags_by_id(filename):
    with open(filename, "rb") as csvfile:
        csvreader = csv.reader(csvfile, delimiter="\t")
        csvreader.next()

        skipcount = 0
        r_by_id = {}
        for row in csvreader:
            if len(row) >= 3:
                feature_id = row[0]
                count = row[1]
                uniqGenes = []
                if count > 0:
                    refGenes = row[2].split(";")
                    uniqGenes = filter(None, list(set(refGenes)))

                logging.debug("%s:%s:%s" % (feature_id, refGenes, uniqGenes))
                if len(uniqGenes) > 0: r_by_id[feature_id] = uniqGenes
            else:
                skipcount += 1

        logging.warning("skipping:%s" % skipcount)
        return r_by_id

def find_and_modify(collection, tags_by_id):
    count = 0
    skipcount = 0
    for doc in collection.find({ "source": "METH", "probe": { "$exists": True } }, { "values": False }):
        if "id" in doc:
            feature_id = str(doc["id"])
            if feature_id in tags_by_id:
                tags = tags_by_id[feature_id]
                if not tags is None:
                    collection.find_and_modify({ "_id": doc["_id"] }, { "$set":{ "refGenes": tags }})
                else:
                    logging.warning("skipping:tags not found:%s" % feature_id)
                    skipcount += 1
            else:
                logging.debug("skipping:feature_id not found:%s" % feature_id)
                skipcount += 1
        else:
            logging.warning("skipping:feature_id not in doc:%s" % str(doc))
            skipcount += 1

        if count > 0 and count % 1000 == 0: logging.info("update [%s]" % count)

    logging.info("total count=%s [skip=%s]" % (count, skipcount))

def main():
    parser = argparse.ArgumentParser(description="Utility to annotate features with probe IDs (i.e. METH) to genes based on annotations file")
    parser.add_argument("--host", required=True, help="MongoDB host name")
    parser.add_argument("--port", required=True, type=int, help="MongoDB port")
    parser.add_argument("--db", required=True, help="Database name")
    parser.add_argument("--f", required=True, help="Methylation probe annotations file")
    parser.add_argument("--loglevel", default="INFO", help="Logging Level")
    args = parser.parse_args()

    configure_logging(args.loglevel.upper())

    logging.info("import file: %s" % args.f)
    logging.info("uploading to %s:%s/%s" % (args.host, args.port, args.db))

    conn = pymongo.Connection(args.host, args.port)
    db = conn[args.db]

    # Extraction Phase
    tags_by_id = extract_tags_by_id(args.f)

    # Database Load Phase
    find_and_modify(db["feature_matrix"], tags_by_id)
    conn.close()

if __name__ == "__main__":
    main()