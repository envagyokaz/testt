import jwt from "jsonwebtoken"
import config from "../config/config"

const verifyToken = (req:any,res:any,next:any) => {
    // Accept token from body/query, x-access-token header, or standard Authorization: Bearer <token>
    let token = req.body?.token || req.query?.token || req.headers?.['x-access-token']
    const authHeader = req.headers?.['authorization'] || req.headers?.['Authorization']
    if (!token && authHeader && typeof authHeader === 'string') {
        const parts = authHeader.split(' ')
        if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') token = parts[1]
    }
    if (!token) {
        return res.status(403).send("Token szükséges")
    }
    try {
         if (!config.jwtSecret) {
        return res.status(403).send("Hiba van a titkos kulccsal")
         }
        const decodedToken = jwt.verify(token,config.jwtSecret)
        req.user = decodedToken
        return next()
    }
    catch (e) {
        console.log(e)
    }
    res.status(401).send("Az auth nem sikerült!")
}

export default verifyToken