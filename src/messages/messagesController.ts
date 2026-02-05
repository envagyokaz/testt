import config from "../config/config"
import mysql from "mysql2/promise"

export const saveMessage = async (req: any, res: any) => {
    // Accept numeric ids or email/username for recipient; groupId may be numeric
    const { content } = req.body
    let { recipientId, recipientEmail, recipient, to, groupId } = req.body
    // canonicalize possible alternative field names
    recipientEmail = recipientEmail || recipient || to || null

    if (!content || typeof content !== 'string') {
        return res.status(400).send({ error: 'Missing content' })
    }

    // senderId comes from verified token middleware
    const senderId = req.user?.userId
    if (!senderId) return res.status(401).send({ error: 'Unauthorized' })

    const connection = await mysql.createConnection(config.database)
    try {
        // If recipient was provided as email/username, resolve to numeric userId
        if (!recipientId && recipientEmail) {
            const [urows] = await connection.execute(
                `SELECT userId, email FROM users WHERE email = ? LIMIT 1`,
                [recipientEmail]
            ) as any
            if (Array.isArray(urows) && urows.length) {
                recipientId = urows[0].userId
            } else {
                // try to resolve by userId-like value if recipientEmail is numeric string
                const maybeId = parseInt(String(recipientEmail));
                if (!Number.isNaN(maybeId)) recipientId = maybeId
            }
        }
        // Insert using the schema defined in dog.sql (messageId, content, senderId, recipientId, groupId, createdAt, delivered, readAt)
        const [result] = await connection.execute(
            `INSERT INTO messages (content, senderId, recipientId, groupId, delivered) VALUES (?, ?, ?, ?, 0)`,
            [content, senderId || null, recipientId || null, groupId || null]
        ) as any

        const insertId = result.insertId
        // Fetch the inserted row with sender info to return full structure matching dog.sql
                const [rows] = await connection.execute(
                        `SELECT m.messageId, m.content, m.senderId, m.recipientId, m.groupId, m.createdAt, m.delivered, m.readAt,
                                        u.email AS senderEmail, u.avatar AS senderAvatar, ru.email AS recipientEmail
                         FROM messages m
                             LEFT JOIN users u ON m.senderId = u.userId
                             LEFT JOIN users ru ON m.recipientId = ru.userId
                         WHERE m.messageId = ?`,
                        [insertId]
                ) as any

        const saved = Array.isArray(rows) && rows.length ? rows[0] : null
        res.status(200).send({ saved })
    } catch (e) {
        console.error(e)
        res.status(500).send({ error: 'Database error' })
    } finally {
        await connection.end()
    }
}

export const getMessages = async (req: any, res: any) => {
    const userId = req.user?.userId
    if (!userId) return res.status(401).send({ error: 'Unauthorized' })

    const withUser = req.query.withUser ? parseInt(req.query.withUser) : null
    const groupId = req.query.groupId ? parseInt(req.query.groupId) : null
    const limit = req.query.limit ? Math.min(parseInt(req.query.limit), 200) : 50
    const beforeId = req.query.beforeId ? parseInt(req.query.beforeId) : null

    const connection = await mysql.createConnection(config.database)
    try {
        let sql = ''
        let params: any[] = []

        if (groupId) {
            sql = `SELECT m.messageId, m.content, m.senderId, m.recipientId, m.groupId, m.createdAt, m.delivered, m.readAt,
                          u.email AS senderEmail, u.avatar AS senderAvatar, ru.email AS recipientEmail
                   FROM messages m LEFT JOIN users u ON m.senderId = u.userId LEFT JOIN users ru ON m.recipientId = ru.userId WHERE m.groupId = ?`
            params.push(groupId)
            if (beforeId) { sql += ' AND m.messageId < ?'; params.push(beforeId) }
            sql += ' ORDER BY m.messageId DESC LIMIT ?'
            params.push(limit)
        } else if (withUser) {
            sql = `SELECT m.messageId, m.content, m.senderId, m.recipientId, m.groupId, m.createdAt, m.delivered, m.readAt,
                          u.email AS senderEmail, u.avatar AS senderAvatar, ru.email AS recipientEmail
                   FROM messages m LEFT JOIN users u ON m.senderId = u.userId LEFT JOIN users ru ON m.recipientId = ru.userId
                   WHERE ((m.senderId = ? AND m.recipientId = ?) OR (m.senderId = ? AND m.recipientId = ?)) AND m.groupId IS NULL`
            params.push(userId, withUser, withUser, userId)
            if (beforeId) { sql += ' AND m.messageId < ?'; params.push(beforeId) }
            sql += ' ORDER BY m.messageId DESC LIMIT ?'
            params.push(limit)
        } else {
            // fallback: messages to or from user
            sql = `SELECT m.messageId, m.content, m.senderId, m.recipientId, m.groupId, m.createdAt, m.delivered, m.readAt,
                          u.email AS senderEmail, u.avatar AS senderAvatar, ru.email AS recipientEmail
                   FROM messages m LEFT JOIN users u ON m.senderId = u.userId LEFT JOIN users ru ON m.recipientId = ru.userId WHERE (m.recipientId = ? OR m.senderId = ?)`
            params.push(userId, userId)
            if (beforeId) { sql += ' AND m.messageId < ?'; params.push(beforeId) }
            sql += ' ORDER BY m.messageId DESC LIMIT ?'
            params.push(limit)
        }

        const [rows] = await connection.execute(sql, params) as any
        // rows are DESC by messageId, reverse to ascending for client consumption
        const messages = Array.isArray(rows) ? rows.reverse() : []
        res.status(200).send({ messages })
    } catch (e) {
        console.error(e)
        res.status(500).send({ error: 'Database error' })
    } finally {
        await connection.end()
    }
}
