"use strict";
var Promise = require("bluebird");
var glob = Promise.promisifyAll(require("glob"));
var path = Promise.promisifyAll(require("path"));
var fs = Promise.promisifyAll(require("fs"));
var gm = Promise.promisifyAll(require("gm"));
var moment = require("moment");
var os = require('os');
var imageMagick = gm.subClass({ imageMagick: true });
var db = require("./db");
var ExifImage = require('exif').ExifImage;
const IMAGES_DIR = process.env.IMAGES_DIR;
const THUMBS_DIR = process.env.THUMBS_DIR;
const THUMBS_L_HEIGHT = 1080;
const THUMBS_S_HEIGHT = 540;
const THUMBS_L_PREFIX = "l_";
const THUMBS_S_PREFIX = "s_";
const cpunb = os.cpus().length;

function isDirSync(aPath) {
  try {
    return fs.statSync(aPath).isDirectory();
  } catch (e) {
    if (e.code === 'ENOENT') {
      return false;
    } else {
      throw e;
    }
  }
}

function getthumbpath(imagepath,thumbprefix){
    let dirpath = path.dirname(imagepath);
    let imgbasename = path.basename(imagepath);
    return THUMBS_DIR+dirpath.substring(IMAGES_DIR.length)+"/"+thumbprefix+imgbasename;
};

function getimagepath(thumbpath,thumbprefix){
    let dirpath = path.dirname(thumbpath);
    let imgbasename = path.basename(thumbpath).substring(thumbprefix.length);
    return IMAGES_DIR+dirpath.substring(THUMBS_DIR.length)+"/"+imgbasename;
};

function getsibling(thumbpath,sourceprefix,targetprefix){
    let dirpath = path.dirname(thumbpath);
    let thumbname = path.basename(thumbpath);
    return dirpath+"/"+targetprefix+thumbname.substring(sourceprefix.length);
};


function createthumb(image,thumbheight,thumbprefix)  {

    return new Promise(function(resolve, reject){

        // thumb path 
        var thumb = getthumbpath(image,thumbprefix);

        // obtain the size of an image
        imageMagick(image).size(function (err, size) {
            if (err) {
                console.log(err);
                return reject(err);
            } else {
                //console.log(new Date().toISOString()+ ' - '+image+' size=' + size.width+'x'+size.height);

                if (size.height > thumbheight)  {
                    
                    if (!isDirSync(path.dirname(thumb))) {
                        fs.mkdirSync(path.dirname(thumb));
                        console.log('created dir ' + path.dirname(thumb));
                    }
                    
                    imageMagick(image)
                    .resize(Math.round(size.width*thumbheight/size.height), thumbheight)
                    .autoOrient()
                    .write(thumb, function (err) {
                        if (err) {
                            console.log(err);
                            return reject(err);
                        } else {
                            console.log('created thumb '+thumb);
                            return resolve(thumb);
                        }
                    });
                }
            }
        });
    });
};

function deletefile(thumb){

    if (thumb.startsWith(THUMBS_DIR)){
        return fs.unlinkAsync(thumb)
        .then(function(result){
            console.log("deleted "+thumb);
            return Promise.resolve(result);
        })
        .catch(function(error){
            return Promise.reject(new Error("error intentando borrar fichero "+thumb));
        });
    } else {
        return Promise.reject(new Error("solo se admite borrar en thumbs. aqui: "+thumb));
    }
}


function getexif(path){

    return new Promise(function(resolve, reject) {
        try {
            new ExifImage({ image : path }, function (error, exifData) {
                if (error){
                    console.log('Error in getexif for '+path+': '+ error.message);
                    resolve(null);
                } else {
                    resolve(exifData);
                }
            });
        } catch (error) {
            console.log('getexif error for '+path+': '+ error.message);
            resolve(null);
        }
    });
};

function enrichimage(imgdetails){

    if (!(imgdetails) || imgdetails.length==0) {return Promise.resolve(null);}

    let imgpath = imgdetails[0];
    let stats = imgdetails[1];
    let exifdata = imgdetails[2];
    

    if (!(stats.isFile())){ 
        console.log(imgpath + " is not a file");
        return Promise.resolve(null);
    }
    // moment(exifdata.exif.CreateDate,['YYYY:MM:DD HH:mm:ss','YYYY/MM/DD HH:mm:ss');
    let thumb = getthumbpath(imgpath,THUMBS_L_PREFIX);
    let sthumb = getsibling(thumb,THUMBS_L_PREFIX,THUMBS_S_PREFIX);

    var image = {
            path : imgpath,
            filename : path.basename(imgpath),
            dir : path.dirname(imgpath),
            extension : path.extname(imgpath),
            largethumb: thumb,
            smallthumb: sthumb,
            mtime : stats.mtime,
            ctime : stats.ctime,
            birthtime : stats.birthtime
    };

    if (exifdata!=null){
        let create_date = moment(exifdata.exif.CreateDate,'YYYY:MM:DD HH:mm:ss').toDate();
        image.created_at=create_date;
        image.info=exifdata.image;
        image.gps=exifdata.gps;
        image.exif=exifdata.exif;
    }

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
        console.log('error en tratar imagen: '+error);
        return Promise.reject(error);
    });
}

function scan() {
    var started_at = new Date();
    var imagespattern = IMAGES_DIR+"/**/*.jpg";
    var thumbspattern = THUMBS_DIR+"/**/"+THUMBS_L_PREFIX+"*.jpg";

    console.log("*** Starting scan. ***");

    Promise.all([glob.globAsync(imagespattern,{nocase:true}),
                 db.listAllImages(), 
                 glob.globAsync(thumbspattern,{nocase:true})])
    .then(function(results) {
        let fsimages = results[0];
        let dbimages = results[1];
        let fsthumbs = results[2];

        // check images found on fs versus in DB
        let imagestoinsert = [];
        let thumbstocreate = []; 
        fsimages.forEach(function(item){
            
            let im = dbimages.findIndex(function(element,index,array){return element.path==item});

            if (im < 0){
                //console.log("file not found in db: "+ item);
                //insertimage(item);
                imagestoinsert.push(item);
            }

            let thb = fsthumbs.findIndex(function(element,index,array){
                return (getimagepath(element,THUMBS_L_PREFIX) == item);
            });

            if (thb < 0){
                //console.log("file not found in thumbs: "+ item);
                thumbstocreate.push(item);
            }
        });
        
        // check images found in DB versus on fs and delete the obsolete ones
        let imagestodelete = [];
        dbimages.forEach(function (item){
            
            let im = fsimages.findIndex(function(element,index,array){return element==item.path});

            if (im < 0){ // esta en BBDD pero no en el fs, remove from db
                imagestodelete.push(item._id);
            }
        });
        
        let thumbstodelete = [];
        fsthumbs.forEach(function(item){

            let thb = fsimages.findIndex(function(element,index,array){
                return (getimagepath(element,THUMBS_L_PREFIX) == item);
            });

            if (thb < 0){ // esta en los thumbnails pero no en las imagenes
                thumbstodelete.push(item);
            }
        });

        console.log("*** Finished initial scan. Images to insert:"+imagestoinsert.length+", thumbs to create: "+thumbstocreate.length+" ***");

        Promise.map(imagestoinsert,function(image){
            return insertimage(image);
        }, {concurrency: cpunb*2})
        .then(function(){
            console.log("*** Inserted all images, now creating thumbs. ***");
            return Promise.map(thumbstocreate, function(image){
                return createthumb(image,THUMBS_L_HEIGHT,THUMBS_L_PREFIX)
                .then(function(r){return createthumb(image,THUMBS_S_HEIGHT,THUMBS_S_PREFIX)});
            },{concurrency: cpunb});
        })
        .then(function(){
            console.log("*** Created all thumbs, now deleting missing thumbnails. ***");
            return Promise.map(thumbstodelete, function(thumb){
                return deletefile(thumb)
                .then(function(r){return deletefile(getsibling(thumb,THUMBS_L_PREFIX,THUMBS_S_PREFIX))});
            },{concurrency: cpunb*2})
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
            console.log(new Date().toISOString+" - Error: "+error);
        });

    });
}

exports.scan = scan;