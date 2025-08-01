import { uploadsApi } from "~/api"

async function storeLocalFile(file) {
  let formData = new FormData()
  formData.append("file", file)
  const response = await uploadsApi.uploadFile(formData)
  response.extension = file.name.split(".").pop()
  return response
}

export const storeFile = async (file, options = {}) => {
  if (useFeatureFlag('storage.local'))
    return storeLocalFile(file, options)

  const response = await uploadsApi.getSignedStorageUrl({
    ...options.data,
    bucket: options.bucket || "",
    content_type: options.contentType || file.type,
    expires: options.expires || "",
    visibility: options.visibility || "",
    baseURL: options.baseURL || null,
    headers: options.headers || {},
    ...options.options,
  })

  // Upload to S3
  await useFetch(response.url, {
    method: "PUT",
    body: file,
  })

  response.extension = file.name.split(".").pop()

  return response
}
