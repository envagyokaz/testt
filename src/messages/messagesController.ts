import config from "../config/config"
import mysql from "mysql2/promise"

export const saveMessage = async (req: any, res: any) => {
    // Accept numeric ids or email/username for recipient; groupId may be numeric
    const { content, fileUrl, fileName, fileType } = req.body
    let { recipientId, recipientEmail, recipient, to, groupId, fileId } = req.body
    // canonicalize possible alternative field names
    recipientEmail = recipientEmail || recipient || to || null

    // Allow empty content if file is attached
    if ((!content || typeof content !== 'string') && !fileUrl && !fileId) {
        return res.status(400).send({ error: 'Missing content or file' })
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
        
        // Extract fileId from fileUrl if provided (format: http://host/file/{fileId})
        let resolvedFileId = fileId || null
        if (!resolvedFileId && fileUrl) {
            const urlParts = fileUrl.split('/file/')
            if (urlParts.length > 1) {
                resolvedFileId = urlParts[1]
            }
        }
        
        // Insert message with file reference
        const [result] = await connection.execute(
            `INSERT INTO messages (content, senderId, recipientId, fileId, groupId, delivered) VALUES (?, ?, ?, ?, ?, 0)`,
            [content || '', senderId || null, recipientId || null, resolvedFileId, groupId || null]
        ) as any

        const insertId = result.insertId
        // Fetch the inserted row with sender info and file details
        const [rows] = await connection.execute(
            `SELECT m.messageId, m.content, m.senderId, m.recipientId, m.fileId, m.groupId, m.createdAt, m.delivered, m.readAt,
                    u.email AS senderEmail, u.avatar AS senderAvatar, ru.email AS recipientEmail,
                    f.fileName, f.mimeType AS fileType
             FROM messages m
                 LEFT JOIN users u ON m.senderId = u.userId
                 LEFT JOIN users ru ON m.recipientId = ru.userId
                 LEFT JOIN files f ON m.fileId = f.fileId
             WHERE m.messageId = ?`,
            [insertId]
        ) as any

        const savedRow = Array.isArray(rows) && rows.length ? rows[0] : null
        
        // Build response with file URL if file exists
        let saved = savedRow
        if (savedRow && savedRow.fileId) {
            saved = {
                ...savedRow,
                fileUrl: `${config.serverBaseUrl}/file/${savedRow.fileId}`,
                fileName: savedRow.fileName || fileName,
                fileType: savedRow.fileType || fileType
            }
        }
        
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
        
        // Base select includes file information
        const baseSelect = `SELECT m.messageId, m.content, m.senderId, m.recipientId, m.fileId, m.groupId, m.createdAt, m.delivered, m.readAt,
                           u.email AS senderEmail, u.avatar AS senderAvatar, ru.email AS recipientEmail,
                           f.fileName, f.mimeType AS fileType`
        const baseJoins = `FROM messages m 
                          LEFT JOIN users u ON m.senderId = u.userId 
                          LEFT JOIN users ru ON m.recipientId = ru.userId
                          LEFT JOIN files f ON m.fileId = f.fileId`

        if (groupId) {
            sql = `${baseSelect} ${baseJoins} WHERE m.groupId = ?`
            params.push(groupId)
            if (beforeId) { sql += ' AND m.messageId < ?'; params.push(beforeId) }
            sql += ' ORDER BY m.messageId DESC LIMIT ?'
            params.push(limit)
        } else if (withUser) {
            sql = `${baseSelect} ${baseJoins}
                   WHERE ((m.senderId = ? AND m.recipientId = ?) OR (m.senderId = ? AND m.recipientId = ?)) AND m.groupId IS NULL`
            params.push(userId, withUser, withUser, userId)
            if (beforeId) { sql += ' AND m.messageId < ?'; params.push(beforeId) }
            sql += ' ORDER BY m.messageId DESC LIMIT ?'
            params.push(limit)
        } else {
            // fallback: messages to or from user
            sql = `${baseSelect} ${baseJoins} WHERE (m.recipientId = ? OR m.senderId = ?)`
            params.push(userId, userId)
            if (beforeId) { sql += ' AND m.messageId < ?'; params.push(beforeId) }
            sql += ' ORDER BY m.messageId DESC LIMIT ?'
            params.push(limit)
        }

        const [rows] = await connection.execute(sql, params) as any
        
        // Process rows to add fileUrl for messages with files
        const processedRows = Array.isArray(rows) ? rows.map((row: any) => {
            if (row.fileId) {
                return {
                    ...row,
                    fileUrl: `${config.serverBaseUrl}/file/${row.fileId}`
                }
            }
            return row
        }) : []
        
        // rows are DESC by messageId, reverse to ascending for client consumption
        const messages = processedRows.reverse()
        res.status(200).send({ messages })
    } catch (e) {
        console.error(e)
        res.status(500).send({ error: 'Database error' })
    } finally {
        await connection.end()
    }
}
