"use strict";
var Promise = require("bluebird");
var glob = Promise.promisifyAll(require("glob"));
var path = Promise.promisifyAll(require("path"));
var fs = Promise.promisifyAll(require("fs-extra"));
var gm = Promise.promisifyAll(require("gm"));
var moment = require("moment");
var imageMagick = gm.subClass({ imageMagick: true });
var db = require("./db");
var ExifImage = require('exif').ExifImage;
var cst = require("./constants");
var memory = process.memoryUsage();
const THUMBS_L_HEIGHT = 1080;
const THUMBS_S_HEIGHT = 540;
const THUMBS_L_PREFIX = "l_";
const THUMBS_S_PREFIX = "s_";
const factor = cst.CPU_SCAN_FACTOR;

function logmem(str){
    memory = process.memoryUsage();
    console.log(str+'Total: '+(memory.heapTotal/(1024*1024)).toFixed(2)+' MB, Used: '+(memory.heapUsed/(1024*1024)).toFixed(2)+' MB');
};

function getthumbpath(imagepath,thumbprefix){
    let dirpath = path.dirname(imagepath);
    let imgbasename = path.basename(imagepath);
    return cst.THUMBS_DIR+dirpath.substring(cst.IMAGES_DIR.length)+"/"+thumbprefix+imgbasename;
};

function getimagepath(thumbpath,thumbprefix){
    let dirpath = path.dirname(thumbpath);
    let imgbasename = path.basename(thumbpath).substring(thumbprefix.length);
    return cst.IMAGES_DIR+dirpath.substring(cst.THUMBS_DIR.length)+"/"+imgbasename;
};

function getsibling(thumbpath,sourceprefix,targetprefix){
    let dirpath = path.dirname(thumbpath);
    let thumbname = path.basename(thumbpath);
    return dirpath+"/"+targetprefix+thumbname.substring(sourceprefix.length);
};


function createthumb(image,thumbheight,thumbprefix)  {
    
    logmem('');

    return new Promise(function(resolve, reject){

        // thumb path 
        var thumb = getthumbpath(image,thumbprefix);

        // obtain the size of an image
        imageMagick(image).size(function (err, size) {
            if (err) {
                console.error('error while getting image size '+err);
                return resolve();
            } else {
                //console.log(new Date().toISOString()+ ' - '+image+' size=' + size.width+'x'+size.height);

                if (size.height > thumbheight)  {
                    
                    fs.ensureDirSync(path.dirname(thumb));
                    
                    imageMagick(image)
                    .resize(Math.round(size.width*thumbheight/size.height), thumbheight)
                    .autoOrient()
                    .write(thumb, function (err) {
                        if (err) {
                            console.error('error while writing resized image: '+err);
                            return resolve();
                        } else {
                            console.log('created thumb '+thumb);
                            return resolve(thumb);
                        }
                    });
                } else {
                    fs.copyAsync(image,thumb)
                    .then(function(result){
                        console.log('copied image '+ image+' as thumb '+thumb);
                        return resolve(thumb);
                    }).catch(function(error){
                        console.error('error while copying image '+image+', error: '+error);
                        return resolve();
                    });
                }
            }
        });
    });
};

function deletefile(thumb){

    if (thumb.startsWith(cst.THUMBS_DIR)){
        return fs.unlinkAsync(thumb)
        .then(function(result){
            console.log("deleted "+thumb);
            return Promise.resolve(result);
        })
        .catch(function(error){
            console.error("error intentando borrar fichero "+thumb);
            return Promise.resolve();
        });
    } else {
        console.error("solo se admite borrar en thumbs. aqui: "+thumb);
        return Promise.resolve();
    }
}


function getexif(path){
    return new Promise(function(resolve, reject) {
        try {
            new ExifImage({ image : path }, function (error, exifData) {
                if (error){
                    console.error('Error in getexif for '+path+': '+ error.message);
                    return resolve(null);
                } else {
                    return resolve(exifData);
                }
            });
        } catch (error) {
            console.error('getexif error for '+path+': '+ error);
            return resolve(null);
        }
    });
};

function enrichimage(imgdetails){
    
    if (!(imgdetails) || imgdetails.length==0) {return Promise.resolve();}

    let imgpath = imgdetails[0];
    let stats = imgdetails[1];
    let exifdata = imgdetails[2];

    if (!(stats.isFile())){ 
        console.info(imgpath + " is not a file");
        return Promise.resolve();
    }
    let thumb = getthumbpath(imgpath,THUMBS_L_PREFIX);
    let sthumb = getsibling(thumb,THUMBS_L_PREFIX,THUMBS_S_PREFIX);
    let created_at = undefined;
    let reldir = path.dirname(imgpath).substring(cst.IMAGES_DIR.length);
    var image = {
            path : imgpath,
            filename : path.basename(imgpath),
            dir : path.dirname(imgpath),
            rel_dir: reldir,
            extension : path.extname(imgpath),
            largethumb: thumb,
            smallthumb: sthumb,
            mtime : stats.mtime,
            ctime : stats.ctime,
            birthtime : stats.birthtime,
            size : stats.size
    };
    
    if (exifdata!=null){
        if (exifdata.exif.CreateDate){
            created_at = moment(exifdata.exif.CreateDate,'YYYY:MM:DD HH:mm:ss').toDate();
        } else if (exifdata.image.ModifyDate) {
            created_at = moment(exifdata.image.ModifyDate,'YYYY:MM:DD HH.mm.ss').toDate();
        }
        
        image.info = exifdata.image;
        image.gps = exifdata.gps;
        image.exif = exifdata.exif;
    }
    if (!(created_at)) {
        let str_date = image.filename.substring(4,12);
        if (moment(str_date,'YYYYMMDD', true).isValid()){
            created_at = moment(str_date,'YYYYMMDD', true).toDate();
        } else {
            str_date = image.filename.substring(0,15);
            if (moment(str_date,'YYYYMMDD_HHmmss', true).isValid()){
                created_at = moment(str_date,'YYYYMMDD', true).toDate();
            }
        }
    }
    if (!(created_at)) {
        if (image.ctime < image.mtime){
            created_at = image.ctime;
        } else {
            created_at = image.mtime;
        }
    }
    if (!(created_at)){
        created_at = new Date(0);
    }
    image.created_at = created_at;
    let m = moment(created_at);
    m.locale('es');
    let strctime = m.format('DD MMMM YYYY');
    image.str_created_at = strctime;

    return Promise.resolve(image);
}

function insertimage(path){
    return Promise.all([Promise.resolve(path),fs.statAsync(path),getexif(path)])
    .then(function(results){
        return enrichimage(results);
    })
    .then(function(image){
        return db.insertImage(image);
    })
    .catch(function (error){
        console.error('error en tratar imagen: '+error);
        return Promise.resolve();
    });
}

function scan() {
    var started_at = new Date();
    var imagespattern = cst.IMAGES_DIR+"/**/*.jpg";
    var thumbspattern = cst.THUMBS_DIR+"/**/"+THUMBS_L_PREFIX+"*.jpg";

    logmem("*** Starting scan. ***\n");

    Promise.all([glob.globAsync(imagespattern,{nocase:true}),
                 db.listAllImages(), 
                 glob.globAsync(thumbspattern,{nocase:true})])
    .then(function(results) {
        var fsimages = results[0];
        var dbimages = results[1];
        let fsthumbs = results[2];
        logmem("Got results from db and thumb fs and image fs\n");

        var m_dbimg = new Map();
        dbimages.forEach(function(element){
            m_dbimg.set(element.path,element._id);
        });

        var m_thumbs = new Map();
        fsthumbs.forEach(function(element){
            m_thumbs.set(getimagepath(element,THUMBS_L_PREFIX));
        });

        let m_img = new Map();
        fsimages.forEach(function(element){
            m_img.set(element);
        });

        logmem('Maps loaded\n');
        return Promise.resolve([m_dbimg,m_thumbs,m_img]);
    }).then(function(r){
        let m_dbimg = r[0];
        let m_thumbs = r[1];
        let m_img = r[2];
        // check images found on fs versus in DB
        let imagestoinsert = [];
        let thumbstocreate = []; 
        m_img.forEach(function(val,item,m){

            if (!m_dbimg.has(item)){
                imagestoinsert.push(item);
            }

            if (!m_thumbs.has(item)){
                thumbstocreate.push(item);
            }
        });
        
        // check images found in DB versus on fs and delete the obsolete ones
        let imagestodelete = [];
        m_dbimg.forEach(function (val,item,m){
            
            if (!m_img.has(item)){ // esta en BBDD pero no en el fs, remove from db
                imagestodelete.push(val);
            }
        });
        
        let thumbstodelete = [];
        m_thumbs.forEach(function(val,item,m){

            if (!m_img.has(item)){ // esta en los thumbnails pero no en las imagenes
                thumbstodelete.push(getthumbpath(item,THUMBS_L_PREFIX));
            }
        });

        console.log("*** Finished initial scan. ***\n \
        Images to insert: "+imagestoinsert.length+",\n \
        Thumbs to create: "+thumbstocreate.length+",\n \
        Images to delete: "+imagestodelete.length+",\n \
        Thumbs to delete: "+thumbstodelete.length+".");
        logmem('');
        
        Promise.map(imagestoinsert,function(image){
            return insertimage(image);
        }, {concurrency: cst.CPUNB*cst.CPU_SCAN_FACTOR})
        .then(function(){
            console.log("*** Inserted all images, now creating thumbs. ***");
            return Promise.map(thumbstocreate, function(image){
                return createthumb(image,THUMBS_L_HEIGHT,THUMBS_L_PREFIX)
                .then(function(r){
                    return createthumb(image,THUMBS_S_HEIGHT,THUMBS_S_PREFIX)});
            },{concurrency: cst.CPUNB*cst.CPU_SCAN_FACTOR});
        })
        .then(function(){
            console.log("*** Created all thumbs, now deleting missing thumbnails. ***");
            return Promise.map(thumbstodelete, function(thumb){
                return deletefile(thumb)
                .then(function(r){return deletefile(getsibling(thumb,THUMBS_L_PREFIX,THUMBS_S_PREFIX))});
            },{concurrency: cst.CPUNB*cst.CPU_SCAN_FACTOR})
        })
        .then(function(){
            console.log("*** Deleted all thumbs, now removing missing images from DB. ***");
            if (imagestodelete.length > 0) {
                return db.deleteImages({_id:{$in: imagestodelete}});
            };
        })
        .then(function(){
            let ts = Math.abs(new Date().getTime() - started_at.getTime())/1000;
            console.log("*** Finished scan: "+Math.floor(ts/(60))+"m "+Math.round(ts%60)+"s. ***");
        })
        .catch(function(error){
            console.log("Error: "+error);
        });
    });
}

exports.scan = scan;