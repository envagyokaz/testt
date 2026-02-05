import dotenv from "dotenv"
import multer from "multer"
import util from "util"
import config from "../config/config"
dotenv.config()



const storage = multer.diskStorage({
    destination: (_req,_file,cb) => {
        cb(null,config.baseDir + config.uploadDir)
    }
})

const avatarStorage = multer.diskStorage({
    destination: (_req,_file,cb) => {
        cb(null,config.baseDir + config.uploadDir)
    }
})

const uploadFile = multer ({
    storage: avatarStorage,
    limits:{fileSize: config.maxSize}
}).single("file")


const uploadAvatar = multer ({
    storage: storage,
    limits:{fileSize: config.maxSize},
    fileFilter: (_req, file, cb) => {
        if (file.mimetype == "image/png" || file.mimetype == "image/jpg" || file.mimetype == "image/jpeg") {
            cb(null, true);
        } else {
            return cb(new Error('Invalid mime type'));
        }
    }
}).single("avatar")

const uploadFiles =  multer ({
    storage: storage,
    limits:{fileSize: config.maxSize}
}).array("files",10)

// Profile picture handler - accepts "profilePic" form field, images only
const profilePicHandler = multer({
    storage: storage,
    limits: { fileSize: config.maxSize },
    fileFilter: (_req, uploadedFile, callback) => {
        const allowedTypes = ["image/png", "image/jpg", "image/jpeg", "image/gif", "image/webp"]
        if (allowedTypes.includes(uploadedFile.mimetype)) {
            callback(null, true)
        } else {
            callback(new Error('Only image files allowed'))
        }
    }
}).single("profilePic")

export const uploadMiddleware = util.promisify(uploadFile)
export const uploadAvatarMiddleware = util.promisify(uploadAvatar)
export const uploadMiddlewareMultiple = util.promisify(uploadFiles)
export const uploadProfilePicMiddleware = util.promisify(profilePicHandler)