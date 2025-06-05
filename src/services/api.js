const API_BASE_URL = 'https://my-epi-api-daniels-projects-83a49977.vercel.app';
// const API_BASE_URL = 'http://localhost:3000/api';

async function get(endpoint) {
    try {
        const response = await axios.get(`${API_BASE_URL}/${endpoint}`, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (error) {
        console.error(`Erro ao fazer GET em ${endpoint}:`, error);
        throw error;
    }
}

async function post(endpoint, data) {
    try {
        let config = {};
        
        // Se for FormData, não definir Content-Type (deixar o browser definir)
        if (!(data instanceof FormData)) {
            config.headers = {
                'Content-Type': 'application/json'
            };
        }
        
        const response = await axios.post(`${API_BASE_URL}/${endpoint}`, data, config);
        return response.data;
    } catch (error) {
        console.error(`Erro ao fazer POST em ${endpoint}:`, error);
        throw error;
    }
}

async function put(endpoint, data) {
    try {
        let config = {};
        
        // Se for FormData, não definir Content-Type (deixar o browser definir)
        if (!(data instanceof FormData)) {
            config.headers = {
                'Content-Type': 'application/json'
            };
        }
        
        const response = await axios.put(`${API_BASE_URL}/${endpoint}`, data, config);
        return response.data;
    } catch (error) {
        console.error(`Erro ao fazer PUT em ${endpoint}:`, error);
        throw error;
    }
}

async function deleteRequest(endpoint) {
    try {
        const response = await axios.delete(`${API_BASE_URL}/${endpoint}`, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (error) {
        console.error(`Erro ao fazer DELETE em ${endpoint}:`, error);
        throw error;
    }
}

export { get, post, put, deleteRequest };