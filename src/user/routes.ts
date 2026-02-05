import { Router } from "express"
import { signIn, signUp, changeAvatar, getProfilePic, uploadProfilePic } from "../user/userController"
import verifyToken from "../middleware/auth"

const router: Router = Router()
router.post('/user/signin',signIn)
router.post('/user/signup',signUp)
router.put('/user/avatar',verifyToken,changeAvatar)
router.get('/user/profile-pic/:email', verifyToken, getProfilePic)
router.post('/user/profile-pic', verifyToken, uploadProfilePic)
export default router