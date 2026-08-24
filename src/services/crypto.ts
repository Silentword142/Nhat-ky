/**
 * End-to-End Encryption (E2EE) Module
 * Uses Web Crypto API (SubtleCrypto) AES-256-GCM + PBKDF2 key derivation.
 * All plain texts, photos, and handwritten cards are encrypted on the client
 * before being sent to the server. The server only sees encrypted ciphertext blobs.
 */

// Helper to convert array buffer to base64 string
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper to convert base64 string to Uint8Array
export function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Derive AES-GCM 256-bit key from passphrase using PBKDF2
export async function deriveKeyFromPassphrase(passphrase: string, saltString: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const passphraseKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase || 'lovesync-default-secret-key-2024'),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const salt = enc.encode(saltString || 'lovesync-couple-salt-v1');

  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passphraseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt any serializable data object
export async function encryptData<T>(data: T, key: CryptoKey): Promise<{ ciphertext: string; iv: string }> {
  const enc = new TextEncoder();
  const jsonString = JSON.stringify(data);
  const encodedData = enc.encode(jsonString);

  // Generate 12-byte initialization vector for AES-GCM
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    encodedData
  );

  return {
    ciphertext: bufferToBase64(encryptedBuffer),
    iv: bufferToBase64(iv),
  };
}

// Decrypt ciphertext back to original data object
export async function decryptData<T>(ciphertext: string, iv: string, key: CryptoKey): Promise<T | null> {
  try {
    const cipherBuffer = base64ToBuffer(ciphertext);
    const ivBuffer = base64ToBuffer(iv);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBuffer,
      },
      key,
      cipherBuffer
    );

    const dec = new TextDecoder();
    const jsonString = dec.decode(decryptedBuffer);
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.warn('E2EE Decryption failed (wrong key or corrupted data):', error);
    return null;
  }
}
