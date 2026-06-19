"use client";

// Hex string to Uint8Array helper
export function hexToBytes(hex: string): Uint8Array {
  const len = hex.length;
  const bytes = new Uint8Array(len / 2);
  for (let i = 0; i < len; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// Uint8Array to Hex string helper
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ArrayBuffer to Base64 helper
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Base64 to ArrayBuffer helper
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Generate random Hex salt (16 bytes / 128-bit)
export function generateSalt(): string {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

// Derive a 256-bit AES-GCM key from password and salt using PBKDF2
export async function deriveKey(password: string, saltHex: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  const saltBytes = hexToBytes(saltHex);

  // Import password raw key material
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    passwordBytes,
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  // Derive AES-GCM 256-bit key
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes as any,
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false, // Not extractable (remains securely in-memory)
    ["encrypt", "decrypt"]
  );
}

// Encrypt plaintext using AES-GCM (returns prefixed format with Hex IV + Base64 ciphertext)
export async function encryptText(plainText: string, key: CryptoKey): Promise<string> {
  if (!plainText) return "";
  const encoder = new TextEncoder();
  const encodedText = encoder.encode(plainText);

  // AES-GCM requires a random 12-byte IV for every encryption operation
  const iv = new Uint8Array(12);
  window.crypto.getRandomValues(iv);

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv as any,
    },
    key,
    encodedText
  );

  const ivHex = bytesToHex(iv);
  const ciphertextBase64 = arrayBufferToBase64(encryptedBuffer);

  return `__ENCRYPTED__:${ivHex}:${ciphertextBase64}`;
}

// Decrypt ciphertext using AES-GCM (auto fallback for legacy plain text)
export async function decryptText(encryptedString: string, key: CryptoKey): Promise<string> {
  if (!encryptedString) return "";
  if (!encryptedString.startsWith("__ENCRYPTED__:")) {
    return encryptedString; // Legacy unencrypted content fallback
  }

  try {
    const parts = encryptedString.split(":");
    if (parts.length < 3) return "[Error: Invalid encrypted format]";

    const ivHex = parts[1];
    const ciphertextBase64 = parts[2];

    const iv = hexToBytes(ivHex);
    const encryptedBuffer = base64ToArrayBuffer(ciphertextBase64);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv as any,
      },
      key,
      encryptedBuffer
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (err: any) {
    if (err && err.name === "OperationError") {
      console.warn("AES-GCM Decryption failed: Incorrect password or key.");
    } else {
      console.error("AES-GCM Decryption unexpected error:", err);
    }
    return "[Decryption Failed - Check password/key]";
  }
}

// Generate a high-entropy 24-character alphanumeric recovery key (formatted)
export function generateRecoveryKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = new Uint8Array(24);
  window.crypto.getRandomValues(bytes);
  
  let key = "";
  for (let i = 0; i < 24; i++) {
    if (i > 0 && i % 4 === 0) key += "-";
    key += chars[bytes[i] % chars.length];
  }
  return key;
}

// Generate SHA-256 hash of a string (useful for storing password/key verifiers)
export async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
  const hashBytes = new Uint8Array(hashBuffer);
  return bytesToHex(hashBytes);
}
