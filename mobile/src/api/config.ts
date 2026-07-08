import axios from 'axios';
import {Platform} from 'react-native';

const RENDER_URL = 'https://ontime-okry.onrender.com';
const LAN_IP = '192.168.2.79';

const BACKEND: 'render' | 'usb' | 'wifi' | 'emulator' = 'render';

const HOST =
  BACKEND === 'render'
    ? RENDER_URL
    : BACKEND === 'usb'
    ? 'http://localhost:8000'
    : BACKEND === 'wifi'
    ? `http://${LAN_IP}:8000`
    : Platform.OS === 'android'
    ? 'http://10.0.2.2:8000'
    : 'http://127.0.0.1:8000';

export const API_BASE_URL = HOST;

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: {'Content-Type': 'application/json'},
});

export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};
