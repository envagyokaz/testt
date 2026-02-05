# Backend Requirements for New Chat Features

## Required Endpoints

### 1. File Upload Endpoint
```javascript
POST /upload
Content-Type: multipart/form-data
Authorization: Bearer <token>

Request Body:
- file: File (binary)

Response (200 OK):
{
  "fileUrl": "http://10.5.0.50:3000/uploads/filename.ext",
  "url": "http://10.5.0.50:3000/uploads/filename.ext" // alternative field
}

Error Response (400/500):
{
  "error": "Error message"
}
```

**Implementation Notes:**
- Use multer or similar middleware for file upload handling
- Store files in a secure location (e.g., ./uploads directory or cloud storage)
- Generate unique filenames to avoid collisions
- Validate file size (recommend max 10MB)
- Validate file types (images, documents, etc.)
- Return the public URL where the file can be accessed

### 2. Profile Picture Upload Endpoint
```javascript
POST /user/profile-pic
Content-Type: multipart/form-data
Authorization: Bearer <token>

Request Body:
- profilePic: File (image file)

Response (200 OK):
{
  "profilePicUrl": "http://10.5.0.50:3000/profile-pics/username.jpg"
}

Error Response (400/500):
{
  "error": "Error message"
}
```

**Implementation Notes:**
- Extract username from JWT token
- Only accept image files (jpeg, png, gif, webp)
- Resize/compress images to reasonable size (e.g., 200x200px)
- Store in profile-pics directory or database
- Update user record with profile picture URL

### 3. Get Profile Picture Endpoint
```javascript
GET /user/profile-pic/:username
Authorization: Bearer <token>

Response (200 OK):
{
  "profilePicUrl": "http://10.5.0.50:3000/profile-pics/username.jpg"
}

Response (404 Not Found):
{
  "profilePicUrl": null
}
```

**Implementation Notes:**
- Retrieve profile picture URL from user record
- Return null or empty if user has no profile picture

### 4. Update Message Save Endpoint
```javascript
POST /message/save
Content-Type: application/json
Authorization: Bearer <token>

Request Body:
{
  "from": "user@example.com",
  "to": "recipient@example.com", // optional, for private messages
  "group": "group-name", // optional, for group messages
  "content": "Message text",
  "chatType": "public" | "private" | "group",
  "timestamp": 1234567890,
  "fileUrl": "http://10.5.0.50:3000/uploads/file.pdf", // optional
  "fileName": "document.pdf", // optional
  "fileType": "application/pdf" // optional
}

Response (200 OK):
{
  "id": "message-id",
  "success": true
}
```

**Implementation Notes:**
- Add fileUrl, fileName, fileType fields to message schema
- These fields are optional (only present when file is attached)

### 5. Update Messages Fetch Endpoint
```javascript
GET /messages
Authorization: Bearer <token>

Response (200 OK):
[
  {
    "messageId": "msg-123",
    "senderEmail": "user@example.com",
    "recipientEmail": "other@example.com", // optional
    "groupId": "group-123", // optional
    "content": "Message text",
    "createdAt": "2026-02-02T10:00:00Z",
    "fileUrl": "http://10.5.0.50:3000/uploads/image.jpg", // optional
    "fileName": "screenshot.jpg", // optional
    "fileType": "image/jpeg" // optional
  }
]
```

**Implementation Notes:**
- Include fileUrl, fileName, fileType in message response
- Return null or omit fields if no file attached

## Database Schema Updates

### Message Model
```javascript
{
  messageId: String,
  senderEmail: String,
  recipientEmail: String, // for private messages
  groupId: String, // for group messages
  content: String,
  createdAt: Date,
  timestamp: Number,
  
  // NEW FIELDS:
  fileUrl: String,      // URL to uploaded file
  fileName: String,     // Original filename
  fileType: String      // MIME type
}
```

### User Model
```javascript
{
  username: String,
  email: String,
  password: String,
  
  // NEW FIELD:
  profilePicUrl: String  // URL to profile picture
}
```

## WebSocket Updates

### Broadcast Message Format
When a user sends a message with a file, the WebSocket server should broadcast:

```javascript
{
  "type": "public_message" | "private_message" | "group_message",
  "from": "username",
  "to": "recipient", // for private
  "group": "group-name", // for group
  "content": "Message text",
  "timestamp": 1234567890,
  "fileUrl": "http://10.5.0.50:3000/uploads/file.pdf", // optional
  "fileName": "document.pdf", // optional
  "fileType": "application/pdf" // optional
}
```

## File Storage Recommendations

### Option 1: Local Storage
```javascript
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 1000 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Add file type validation
    cb(null, true);
  }
});
```

### Option 2: Cloud Storage (AWS S3, Azure Blob, etc.)
- More scalable for production
- Better performance
- Automatic backups
- CDN integration

## Security Considerations

1. **File Validation:**
   - Check file size limits
   - Validate MIME types
   - Scan for malware
   - Prevent path traversal attacks

2. **Access Control:**
   - Verify user authentication for all endpoints
   - Check user permissions for file access
   - Implement rate limiting for uploads

3. **File Naming:**
   - Use UUIDs or timestamps for unique filenames
   - Sanitize original filenames
   - Prevent directory traversal in filenames

4. **Storage:**
   - Store files outside web root when possible
   - Implement file cleanup for old/unused files
   - Set appropriate file permissions

## Testing Checklist

- [ ] Upload image file
- [ ] Upload PDF document
- [ ] Upload file with special characters in name
- [ ] Upload file larger than size limit (should fail)
- [ ] Upload malicious file (should fail)
- [ ] Download uploaded file
- [ ] Set profile picture
- [ ] Load profile picture on app start
- [ ] Send message with file attachment
- [ ] Receive message with file attachment
- [ ] Save and load messages with attachments from database
