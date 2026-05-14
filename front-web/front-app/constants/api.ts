export const API_URL = 'http://192.168.1.35:8000';

export const ENDPOINTS = {
  login:          `${API_URL}/token`,
  register:       `${API_URL}/register`,
  me:             `${API_URL}/me`,
  updateProfile:  `${API_URL}/me`,
  signalements:   `${API_URL}/signalements`,
  signalement:    (id: string) => `${API_URL}/signalements/${id}`,
  like:           (id: string) => `${API_URL}/signalements/${id}/like`,
  statut:         (id: string) => `${API_URL}/signalements/${id}/statut`,
  commentaires:   (id: string) => `${API_URL}/signalements/${id}/commentaires`,
  notes:          `${API_URL}/notes`,
  moyenne:        `${API_URL}/notes/moyenne`,
  analyseNotes:   `${API_URL}/notes/analyse`,
  infos:          `${API_URL}/infos`,
  infoById:       (id: string) => `${API_URL}/infos/${id}`,
  infoReaction:   (id: string) => `${API_URL}/infos/${id}/reaction`,
  urgences:       `${API_URL}/ia/urgences`,
  kpis:           `${API_URL}/dashboard/kpis`,
  planning:       (classe: string) => `${API_URL}/planning/${classe}`,
  transcription:  `${API_URL}/transcription`,
  notifications:  `${API_URL}/notifications`,
};