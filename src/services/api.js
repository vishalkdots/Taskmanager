//const BASE_URL = 'http://localhost:5000/api';
const BASE_URL = 'https://taskmanager-api-6gbm.onrender.com/api';

/**
 * Helper to dynamically generate authorization headers from localStorage.
 */
const getHeaders = () => {
  const headers = {
    'Content-Type': 'application/json'
  };

  const storedUser = localStorage.getItem('userInfo');
  if (storedUser) {
    try {
      const parsed = JSON.parse(storedUser);
      if (parsed && parsed.token) {
        headers['Authorization'] = `Bearer ${parsed.token}`;
      }
    } catch (err) {
      console.error('Error parsing stored token for API headers:', err);
    }
  }

  return headers;
};

/**
 * Common response handler to parse JSON and capture API errors.
 */
const handleResponse = async (response) => {
  let data = {};
  try {
    data = await response.json();
  } catch (err) {
    // If response does not contain JSON body
  }

  if (!response.ok) {
    const errorMsg = data.message || `Request failed with HTTP status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
};

/**
 * Unified API Client object.
 */
export const api = {
  get: async (endpoint) => {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: getHeaders()
    });
    return handleResponse(response);
  },

  post: async (endpoint, body) => {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body)
    });
    return handleResponse(response);
  },

  put: async (endpoint, body) => {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body)
    });
    return handleResponse(response);
  },

  delete: async (endpoint) => {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(response);
  },

  /**
   * Multipart File Upload wrapper.
   * Leverages custom FormData and excludes Content-Type so boundary is set automatically.
   */
  upload: async (endpoint, formData) => {
    const headers = {};
    const storedUser = localStorage.getItem('userInfo');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        if (parsed && parsed.token) {
          headers['Authorization'] = `Bearer ${parsed.token}`;
        }
      } catch (err) {
        console.error('Error parsing stored token for file upload:', err);
      }
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData
    });
    return handleResponse(response);
  }
};
