# Frontend Handoff: Uploads

## What's new

A standalone file-upload endpoint. Call this **before** creating/updating a resource (or a profile photo) that has a file attached — it returns a URL, which you then send as a plain string field in the other call. Two requests, not one combined upload+create.

## Endpoint

### `POST /uploads` (Bearer)

Send as `multipart/form-data` with a single field named `file` — not JSON.

```js
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const res = await fetch(`${API_BASE}/uploads`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}` }, // do NOT set Content-Type — let the browser set the multipart boundary
  body: formData,
});
```

```json
// 201 Response
{ "url": "https://res.cloudinary.com/defutech-inc/image/upload/v1790147397/edulab/resources/or5bcps859zflf8iicge.png" }
```

Use that `url` string directly as a resource's `file` field, or a profile's `profilePhoto` field.

## Constraints

- **Allowed types**: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `application/pdf`, and Word/PowerPoint/Excel (`.doc`, `.docx`, `.ppt`, `.pptx`, `.xls`, `.xlsx`). Anything else → `400`.
- **Max size**: 15MB → `413` if exceeded. Validate client-side before uploading to avoid the round trip.
- **Rate limit**: 10 uploads/minute per caller → `429` if exceeded.

## Error responses to handle

| Status | Meaning | When |
|---|---|---|
| 400 | `"No file provided."` | Request sent with no `file` field |
| 400 | `"Unsupported file type: <mimetype>"` | Disallowed file type |
| 401 | — | Missing/invalid bearer token |
| 413 | `"File too large"` | File exceeds 15MB |
| 429 | — | Rate limit exceeded |
| 500 | `"Cloudinary is not configured..."` | Backend misconfiguration, not a client error — surface as a generic "upload failed, try again later" |

## Integration gotchas

- **This call requires auth** — every file upload is tied to a logged-in user, even though the returned URL itself has no access control once issued (anyone with the URL can view it — fine for shared educational resources, worth knowing if you ever need "private" attachments).
- The returned URL is permanent and publicly accessible — there's currently no delete-on-replace behavior, so if a user changes a resource's file, the old Cloudinary asset isn't cleaned up automatically.
- Don't try to combine this with the resource-create form into one request — it's deliberately two separate calls (upload, then create/update with the URL).
