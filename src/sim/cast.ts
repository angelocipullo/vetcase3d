import { SimCase, Speaker, SpeakerId } from './types';

/** Personaggi comuni a tutti i casi. */
export const MENTOR: Speaker = {
  name: 'Primario',
  // pochi capelli biondo miele, occhi azzurri, occhiali tondi neri, baffi biondi
  sprite: { kind: 'human', skin: '#f3d2b3', hair: '#c49a4a', hairStyle: 'thin', clothes: '#4c6ef5', coat: true, glasses: 'round', eyes: '#4dabf7', mustache: true },
};

export const NURSE: Speaker = {
  name: 'Infermiere',
  sprite: { kind: 'human', skin: '#c68e63', hair: '#2b2118', hairStyle: 'bun', clothes: '#12b886' },
};

export function speaker(c: SimCase, who: SpeakerId): Speaker {
  switch (who) {
    case 'owner':
      return c.cast.owner;
    case 'mentor':
      return MENTOR;
    case 'nurse':
      return NURSE;
    case 'patient':
      return { name: c.patient.name, sprite: c.cast.patient };
    case 'narratore':
      return { name: '' };
  }
}
