import express from "express"
import router from "../routes/routes"
import dogRouter from "../dog/routes"
import userRouter from "../user/routes"
import uploadRouter from "../upload/routes"
import messageRouter from "../messages/routes"
import cors from "cors"
import bodyParser from "body-parser"

const app = express()
// Explicitly allow Authorization header so frontend Bearer tokens pass CORS preflight
app.use(cors({
	origin: '*',
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
	allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
	exposedHeaders: ['Authorization']
}))

app.use(express.json())
app.use(bodyParser.urlencoded({extended: true}))
app.use(bodyParser.json())

app.use('/',router)
app.use('/', dogRouter)
app.use('/',userRouter)
app.use('/',uploadRouter)
app.use('/', messageRouter)

export default app

