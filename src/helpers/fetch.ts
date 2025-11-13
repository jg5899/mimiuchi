async function post(url: string, body: any) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    // Handle JSON parsing errors
    const json = await response.json()
    return json
  }
  catch (err: any) {
    throw new Error(`Request failed: ${err.message}`)
  }
}

export default { post }
