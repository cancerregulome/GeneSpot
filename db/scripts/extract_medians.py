'''
Created on Jun 10, 2014

for the list of tumor types, go through the features and for the given
platform, collect the medians for all the features and output them
tab-delimited to the given file

@author: michael
'''
import argparse
import logging
import pymongo

from utilities import configure_logging

def outputValues(outfile, dbs, gene2tumor2median):
    logging.info('\n\tstarting outputValues()')
    with open(outfile, 'w') as out:
        out.write('\t' + '\t'.join(dbs) + '\n')
        genes = gene2tumor2median.keys()
        genes.sort()
        for gene in genes:
            line = gene
            for db in dbs:
                line += '\t' + str(gene2tumor2median[gene].get(db, 'NA'))
            out.write(line + '\n')
    logging.info('\n\tfinished outputValues()')

def processTumors(args):
    gene2tumor2median = {}
    conn = pymongo.Connection(args.host, args.port)
    logging.info('\n\tstarting processTumors()')
    for db in args.dbs:
        logging.info('\n\t\treading %s' % (db))
        collection = conn[db]["feature_matrix"]
        docs = collection.find({"source": args.platform})
        for doc in docs:
            tumor2median = gene2tumor2median.setdefault(doc["label"], {})
            tumor2median[db] = doc["statistics"]["numeric"]["median"]

    conn.close()
    logging.info('\n\tfinished processTumors()')
    return gene2tumor2median

def main():
    parser = argparse.ArgumentParser(description="Utility to produce a table of genes vs. tumor types w/ median values")
    parser.add_argument("--host", required=True, help="MongoDB host name")
    parser.add_argument("--port", required=True, type=int, help="MongoDB port")
    parser.add_argument("dbs", nargs='+', help="Database names")
    parser.add_argument("--out", required=True, help="where to output the table")
    parser.add_argument("--platform", default="GEXP", help="feature type to find the median from")
    parser.add_argument("--loglevel", default="INFO", help="Logging Level")
    args = parser.parse_args()
    configure_logging(args.loglevel.upper())

    logging.info('starting extract medians:\n\t%s' % (args))
    gene2tumor2median = processTumors(args);
    outputValues(args.out, args.dbs, gene2tumor2median)
    logging.info('finished extract medians')

if __name__ == '__main__':
    main()