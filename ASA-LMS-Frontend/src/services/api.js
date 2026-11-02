import axios from 'axios';

const getBaseURL = () => {
  const envBase = import.meta.env.VITE_API_BASE_URL;
  if (!envBase) return "/api";
  return envBase.endsWith("/api") ? envBase : `${envBase.replace(/\/+$/, "")}/api`;
};

const API = axios.create({
  baseURL: getBaseURL(),
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${import.meta.env.VITE_API_KEY || ""}`,
  },
});

export default API;