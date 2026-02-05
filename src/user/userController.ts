import config from "../config/config"
import mysql from "mysql2/promise"
import jwt from "jsonwebtoken"
import { User } from "./user"
import { uploadAvatarMiddleware, uploadProfilePicMiddleware } from "../middleware/upload"
import { File } from "../file/file"

export const signIn = async (req: any, res: any) => {
    const { email, password } = req.body
    if (!(email && password)) {
        return res.status(400).send({ error: "Nem megfelelően megadott adatok!" })
    }

    const connection = await mysql.createConnection(config.database)
    try {
        const [results] = await connection.query('select login(?,?) as id', [email, password]) as Array<any>

        if (!results[0].id) {
            return res.status(401).send({ error: "Nem megfelelő felhasználónév vagy jelszó!" })
        }
        if (!config.jwtSecret) {
            return res.status(400).send({ error: "Hiba a titkos kulcsnál!" })
        }
        const token = jwt.sign({ userId: results[0].id }, config.jwtSecret, { expiresIn: "2h" })


        res.status(200).send({ token: token })
    } catch (e) {
        console.log(e)
    }
}

export const signUp = async (req: any, res: any) => {
    await uploadAvatarMiddleware(req, res)

    const userBody: Partial<User> = req.body
    
    if (!userBody.email || !userBody.password) {

        new File(req.file).deleteFileDir()
        return res.status(400).send("Nem adott meg minden adatot!!")
        
    }

    const user: User = new User(userBody as Partial<User>)
    await user.saveToDatabase(req.file)
    res.status(200).send(user.getUserData())

}
export const changeAvatar =  async (req:any,res:any) => {
    
      try {
             await uploadAvatarMiddleware(req, res)
            
             if (req.file === undefined) {
                 return res.status(400).send({ error: "Töltsön fel fájlt!" })
             }
             const file: File = new File(req.file, req.user.userId)
             const user = new User()
             await user.loadDataFromDb(req.user.userId)
             const oldAvatar = user.avatar
             user.avatar= req.file.filename
             await file.saveToDatabase()
             await user.updateAvatar()
             const oldFile = new File()
             if (oldAvatar) {
                await oldFile.loadDataFromDb(oldAvatar)
                await oldFile.deleteFromDatabaseAndDir()
             }
             res.status(200).send({ message: `A fájl feltöltése sikerült! ${req.file.originalname}` })
         }
         catch (err) {
             res.status(500).send({
                 error: `A fájl feltöltés nem sikerült! ` + err
             })
         }
}

// Get profile picture URL by email
export const getProfilePic = async (req: any, res: any) => {
    const email = req.params.email
    if (!email) {
        return res.status(400).send({ error: "Email is required" })
    }

    const connection = await mysql.createConnection(config.database)
    try {
        const [results]: any = await connection.query(
            "SELECT avatar FROM users WHERE email = ?", [email]
        )
        
        if (results.length === 0) {
            return res.status(404).send({ error: "User not found" })
        }

        const avatar = results[0].avatar
        if (avatar) {
            const profilePicUrl = `http://10.5.0.50:3000/file/${avatar}`
            res.status(200).send({ profilePicUrl })
        } else {
            res.status(200).send({ profilePicUrl: null })
        }
    } catch (err) {
        console.log(err)
        res.status(500).send({ error: "Database error" })
    } finally {
        await connection.end()
    }
}

// Upload profile picture and return the URL
export const uploadProfilePic = async (req: any, res: any) => {
    try {
        await uploadProfilePicMiddleware(req, res)
        
        if (req.file === undefined) {
            return res.status(400).send({ error: "Please upload a file" })
        }
        
        const file: File = new File(req.file, req.user.userId)
        const user = new User()
        await user.loadDataFromDb(req.user.userId)
        const oldAvatar = user.avatar
        user.avatar = req.file.filename
        await file.saveToDatabase()
        await user.updateAvatar()
        
        const oldFile = new File()
        if (oldAvatar) {
            await oldFile.loadDataFromDb(oldAvatar)
            await oldFile.deleteFromDatabaseAndDir()
        }
        
        const profilePicUrl = `http://10.5.0.50:3000/file/${req.file.filename}`
        res.status(200).send({ 
            message: `Profile picture uploaded successfully!`,
            profilePicUrl 
        })
    } catch (err) {
        res.status(500).send({
            error: `Profile picture upload failed! ` + err
        })
    }
}