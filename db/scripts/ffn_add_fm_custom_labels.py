'''
Created on Jun 4, 2014

usage: add_fm_custom_labels.py --host <host url> --port <port> --db <database name> --tumor <tumor type> --root <root of feature matrix directories> 
    or
usage: add_fm_custom_labels.py --host <host url> --port <port> --db <database name> --f <feature matrix> 
NOTE: --tumor will generally be equal to --db and will default to it if not specified
NOTE: second usage is to be run as part of full script to generate and update the feature matrix in mongodb
NOTE: if the --f option is used, the --root directory will be set to ../.. relative to the file's directory
NOTE: --root must not end with a '/'

@author: michael
'''
import argparse
import logging
import os
import pymongo
import re
import traceback

from utilities import configure_logging

ffnPattern = re.compile('FFN.*\.tsv$')
clusterGroupPattern = re.compile('^[CG]([0-9]+)$')

def removeClusterOrGroup(name):
    match = clusterGroupPattern.match(name)
    if match:
        return match.group(1)
    else:
        return name
    
def display(value):
    value = value.replace('_', ' ')
    return value[0].upper() + value[1:]

def makeLabel(label, fv, typeformat):
    if not typeformat or typeformat == 'Default':
        return label + ': ' + fv
    elif typeformat == 'Append':
        return fv + ' ' + label
    elif typeformat == 'AppendWithParentheses':
        return fv + ' (' + label + ')'
    elif typeformat == 'DoNotDisplay':
        return fv
    elif typeformat == 'Prepend':
        return label + ' ' + fv
    print '''Didn't fall into any case!!!'''

def updateCategoryFeatures(collection, ffv_infos):
    catOnePattern = r'I\(([^,]+)\|%s\)'
    catTwoPattern = r'I\((.+),(.+)\|%s\)'
    for name, ffv_info in ffv_infos.iteritems():
        regex = re.compile(catOnePattern % (name))
        docsOne = collection.find({"id": regex})
        print 'for name %s found %d docs' % (name, docsOne.count())
        for doc in docsOne:
            try:
                nlabel = ffv_info[0]
                match = regex.match(doc['id'].split(':')[2])
                fv = ffv_info[1].get(match.group(1), removeClusterOrGroup(match.group(1)))
                collection.update({'id': doc['id']}, {"$set": {"label": makeLabel(display(nlabel), display(fv), ffv_info[2])}})
            except Exception as e:
                traceback.print_exc()
                print 'problem with updateCategoryFeatures(%s-%s): %s: %s' % (doc['id'], fv, name, ffv_info)
                raise e
        docsOne.close()
            
        regex = re.compile(catTwoPattern % (name))
        docsTwo = collection.find({"id": regex})
        print 'for name %s found %d docs' % (name, docsTwo.count())
        for doc in docsTwo:
            try:
                nlabel = ffv_info[0]
                match = regex.match(doc['id'].split(':')[2])
                fv1 = ffv_info[1].get(match.group(1), removeClusterOrGroup(match.group(1)))
                fv2 = ffv_info[1].get(match.group(2), removeClusterOrGroup(match.group(2)))
                collection.update({'id': doc['id']}, {"$set": {"label": makeLabel(display(nlabel), display(fv1) + ' vs ' + display(fv2), ffv_info[2])}})
            except Exception as e:
                traceback.print_exc()
                print 'problem with updateCategoryFeatures(%s-%s vs %s): %s: %s' % (doc['id'], fv1, fv2, name, ffv_info)
                raise e
        docsTwo.close()
        

def updateLabels(collection, path, ffv_infos):
    logging.info('\ncollection: %s file: %s' % (collection, path))
    count = 0
    with open(path, 'r') as labels:
        labels.readline()
        for line in labels:
            try:
                count += 1
                if '#' == line[0]:
                    continue
                fields = line.strip().split('\t')
                if 2 > len(fields):
                    raise ValueError('did not find two fields!!!')
                
                fields += [None, None]
                doc = collection.find_one({'id': fields[0]})
                ffv_info = [None, {}, None]
                if doc:
                    if 'Default' == fields[1]:
                        fields[1] = ''
                    if fields[1]:
                        logging.info('found %s, updating label to %s', fields[0], fields[1])
                        collection.update({'id': fields[0]}, {"$set": {"label": display(fields[1])}})
                        ffv_info[0] = fields[1]
                    else:
                        name = doc['id'].split(':')[2]
                        logging.info('found %s w/o custom label, updating to default %s', fields[0], display(name))
                        collection.update({'id': fields[0]}, {"$set": {"label": display(name)}})
                        ffv_info[0] = display(name)
                else:
                    logging.info("didn't find %s", (fields[0]))
                    continue
                
                if not ((fields[2] and fields[2] != 'Default') or fields[3]):
                    continue
                
                print 'fields: %s' % (fields)
                if 'Default' == fields[2]:
                    fields[2] = ''
                order = 0
                if fields[2]:
                    ffv_precedence = {}
                    for field in fields[2].split(','):
                        ffv_precedence[field.split(':')[0]] = {'ffv': field.split(':')[1], 'ordinal': order}
                        order += 1
                    collection.update({'id': fields[0]}, {"$set": {"ffv_precedence": ffv_precedence}})
                    print '\tprecedence: %s' % (ffv_precedence)
                    ffv_map = dict([(field.split(':')[0], field.split(':')[1]) for field in fields[2].split(',')])
                    ffv_info[1] = ffv_map
                if fields[3]:
                    ffv_info[2] = fields[3]
     
                ffv_infos[doc['id'].split(':')[2]] = ffv_info
            except Exception as e:
                traceback.print_exc()
                print 'problem with parsing line %d: %s--%s' % (count, line, e)
                raise e

def checkForFFNFile(files, dirname, names):
    for name in names:
        if ffnPattern.search(name):
            files += [dirname + '/' + name];
    
def main():
    parser = argparse.ArgumentParser(description="Utility to add custom labels to TCGA feature matrix in MongoDB")
    parser.add_argument("--host", required=True, help="MongoDB host name")
    parser.add_argument("--port", required=True, type=int, help="MongoDB port")
    parser.add_argument("--db", required=True, help="Database name")
    parser.add_argument("--tumor", help="Tumor type, will default to --db")
    parser.add_argument("--root", help="Root path to search for FFN custom files")
    parser.add_argument("--f", help="Path of feature matrix, used to set --root for FFN custom files")
    parser.add_argument("--dir", default="aux", help="directory to look for FFN custom files")
    parser.add_argument("--loglevel", default="INFO", help="Logging Level")
    args = parser.parse_args()
    if not args.tumor:
        args.tumor = args.db
    if not args.root:
        args.root = os.path.dirname(os.path.dirname(os.path.dirname(args.f)))
    configure_logging(args.loglevel.upper())

    logging.info('starting add custom labels to feature matrix:\n\t%s' % (args))

    args.topfiles = [];
    args.tumorfiles = []
    for root, _, files in os.walk(args.root, followlinks = True):
        basedir = os.path.dirname(root)
        namedir = os.path.basename(root)
        if basedir == args.root and namedir == args.dir:
            checkForFFNFile(args.topfiles, root, files)
        if args.tumor.lower() == os.path.basename(basedir).lower() and namedir == args.dir:
            checkForFFNFile(args.tumorfiles, root, files)

    logging.info('%s %s', args.topfiles, args.tumorfiles)
    
    conn = pymongo.Connection(args.host, args.port)
    collection = conn[args.db]["feature_matrix"]
    ffv_infos = {}
    if 0 == len(args.topfiles):
        raise ValueError('did not find a general custom file')
    else:
        for topfile in args.topfiles:
            updateLabels(collection, topfile, ffv_infos);
    if 0 == len(args.tumorfiles):
        logging.info('did not find a tumor type custom file')
    else:
        for tumorfile in args.tumorfiles:
            updateLabels(collection, tumorfile, ffv_infos);
    updateCategoryFeatures(collection, ffv_infos)
    conn.close()
    
    logging.info('finished add custom labels to feature matrix')

if __name__ == '__main__':
    main()
