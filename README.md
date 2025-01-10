# BangApp Video Streaming Server Documentation

## Overview

The BangApp Streaming Server is a backend server that supports the BangApp application. It provides various APIs for video management, and video streaming. This documentation outlines the available API endpoints, their usage, and the expected request and response formats.

This Backend accepts video and converts the video in diffrent resolutions to m3u8 and when streaming it looks at the speed of users internet and check which video resolution to play based on user speed

## API Endpoints

### 1. Video Management

#### **GET /api/videos**

This endpoint retrieves a list of all videos available for streaming.

**Request:**

- **URL:** `/api/videos`
- **Method:** `GET`

**Response:**

- **Success (200):**
  ```json
  {
    "videos": [
      {
        "id": "video-id",
        "user": "Uploaded by",
        "title": "video title",
        "description": "Video Description",
        "thumbnails": [{
          "id": "thumbnail-id",
          "url": "Thumbnail url",
          "size": "Thumbnail size in kb",
          "height": "Thumbnail height",
          "width": "Thumbnail width",
          "created_at": "Thumbnail time_stamp",
        }, 
        ...]
        "video_created_at": "time stamp"
      },
      ...
    ]
  }
  ```

#### **POST /api/upload**

This endpoint allows a registered user to upload a new video.

**Request:**

- **URL:** `/api/upload`
- **Method:** `POST`
- **Headers:** 
  - `Authorization: Bearer jwt-token-string`
  - `Content-Type: multipart/form-data`
- **Body:** FormData with fields:
  - `title` (string): Title of the video.
  - `description` (string): Description of the video.
  - `video` (file): Video file to be uploaded.

**Response:**

- **Success (201):**
  ```json
  {
    "message": "Video uploaded successfully",
    "video": {
      "id": "video-id",
      "title": "Video Title"
    }
  }
  ```

**Example:**

```javascript
let chunks = [];
  // Divide file into chunks and store into Array
  const handleUpload = (videoFile) => {
    try {
      const chunkSize = 1024 * 1024 * 2;
      let offset = 0;

      while (offset < videoFile.size) {
        const chunk = videoFile.slice(offset, offset + chunkSize);
        chunks.push(chunk);
        offset += chunkSize;
      }

      const isLast = chunks.length === 1;
      const chunk = chunks.shift();
      onUploadChunk(videoFile, chunk);

    } catch (error) {
      console.log(error);
    }
  };

  const onUploadChunk = (videoFile, chunk, isLast = false) => {
    const { id, name, lastModified, size } = videoFile;

    const formData = new FormData();
    formData.append('id', id);
    formData.append('video', chunk, name);
    formData.append('lastModified', lastModified);
    formData.append('size', size);
    formData.append('isTail', isLast);

    readyAxios
      .post(`api/upload`, formData)
      .then((data) => {         
        if (data.status === 200) {
          // this will run recursively
          if(chunks.length >= 1){
            const isLast = chunks.length === 1;
            const chunk = chunks.shift();
            onUploadChunk(videoFile, chunk, isLast)
          }
        }
      })
      .catch((err) => {
        console.log(err);
      });
  };

  handleUpload(videoFile)

```

- **Failure (400):**
  ```json
  {
    "error": "Invalid video format"
  }
  ```

### 4. Video Streaming

#### **GET /api/videos/player/:id** - get video by id for player

This endpoint retrieves a list of all videos available for streaming.

**Request:**

- **URL:** `/api/videos/player/:id`
- **Method:** `GET`

**Response:**

- **Success (200):**
  ```json
  {
    "ok": true,
    "message": "retrieved successfully",
    "data": {
              "id": "video-id",
              "url": "https://api.whiteblob.site/api/media/xxxxxxxxx/master.m3u8",
            }
  }
  ```

## Error Handling

All error responses follow a consistent format:
```json
{
  "error": "Error message"
}
```

## Authentication

Endpoint `/api/upload` require a valid JWT token to be included in the `Authorization` header of the request.

Example:
```
Authorization: Bearer jwt-token-string
```

## Response Codes

- **200 OK:** The request was successful.
- **201 Created:** The resource was successfully created.
- **400 Bad Request:** The request was invalid or cannot be served.
- **401 Unauthorized:** The request requires user authentication.
- **404 Not Found:** The requested resource could not be found.
- **500 Internal Server Error:** An error occurred on the server.

## Contribution

We welcome contributions to improve the WhiteBlob Streaming Server. To contribute, follow these steps:

1. Fork the repository.
2. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes.
4. Commit your changes:
   ```bash
   git commit -m "Add your message"
   ```
5. Push to the branch:
   ```bash
   git push origin feature/your-feature-name
   ```
6. Open a pull request on GitHub.

## License

This project is licensed under the MIT License.

---

For any further questions or support, please contact us at [support.bangap,pro](mailto:support@bangapp.pro).
