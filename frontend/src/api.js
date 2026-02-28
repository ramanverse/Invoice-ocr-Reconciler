import axios from 'axios';

const API = axios.create({
    baseURL: 'http://localhost:5001/api',
    timeout: 60000,
});

// Request interceptor
API.interceptors.request.use(
    (config) => config,
    (error) => Promise.reject(error)
);

// Response interceptor
API.interceptors.response.use(
    (res) => res.data,
    (err) => Promise.reject(err.response?.data || err)
);

export const invoiceAPI = {
    upload: (formData, onProgress) =>
        axios.post('http://localhost:5001/api/invoices/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / e.total)),
            timeout: 120000,
        }).then(r => r.data),

    getAll: (params) => API.get('/invoices', { params }),
    getOne: (id) => API.get(`/invoices/${id}`),
    update: (id, data) => API.put(`/invoices/${id}`, data),
    delete: (id) => API.delete(`/invoices/${id}`),
};

export const registerAPI = {
    upload: (formData) =>
        axios.post('http://localhost:5001/api/register/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }).then(r => r.data),
};

export const reconcileAPI = {
    run: (data) => API.post('/reconcile', data),
    link: (data) => API.post('/reconcile/link', data),
    history: () => API.get('/reconciliations'),
    exportCSV: (sessionId) => `http://localhost:5001/api/report/${sessionId}/csv`,
    exportPDF: (sessionId) => `http://localhost:5001/api/report/${sessionId}/pdf`,
};

export const statsAPI = {
    get: () => API.get('/stats'),
};

export default API;
