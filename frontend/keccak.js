// Self-contained Keccak-256 (Ethereum keccak, not SHA3-256). No dependencies.
// Exposes globalThis.keccak256(bytes: Uint8Array) -> lowercase hex (no 0x).
(function (root) {
  "use strict";
  const MASK = (1n << 64n) - 1n;
  const rotl = (x, n) => ((x << n) | (x >> (64n - n))) & MASK;

  const RC = [
    0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
    0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
    0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
    0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
    0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
    0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
  ];
  const ROT = [
    [0n, 36n, 3n, 41n, 18n],
    [1n, 44n, 10n, 45n, 2n],
    [62n, 6n, 43n, 15n, 61n],
    [28n, 55n, 25n, 21n, 56n],
    [27n, 20n, 39n, 8n, 14n],
  ];

  function keccakF(s) {
    for (let round = 0; round < 24; round++) {
      const C = new Array(5);
      for (let x = 0; x < 5; x++) C[x] = s[x] ^ s[x + 5] ^ s[x + 10] ^ s[x + 15] ^ s[x + 20];
      const D = new Array(5);
      for (let x = 0; x < 5; x++) D[x] = C[(x + 4) % 5] ^ rotl(C[(x + 1) % 5], 1n);
      for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) s[x + 5 * y] ^= D[x];

      const B = new Array(25).fill(0n);
      for (let x = 0; x < 5; x++)
        for (let y = 0; y < 5; y++)
          B[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(s[x + 5 * y], ROT[x][y]);

      for (let x = 0; x < 5; x++)
        for (let y = 0; y < 5; y++)
          s[x + 5 * y] = B[x + 5 * y] ^ (~B[((x + 1) % 5) + 5 * y] & MASK & B[((x + 2) % 5) + 5 * y]);

      s[0] ^= RC[round];
    }
  }

  function keccak256(bytes) {
    const rate = 136;
    const s = new Array(25).fill(0n);
    const len = bytes.length;
    let i = 0;
    const absorb = (block) => {
      for (let k = 0; k < rate; k++) {
        s[k >> 3] ^= BigInt(block[k]) << BigInt(8 * (k & 7));
      }
      keccakF(s);
    };
    for (; i + rate <= len; i += rate) absorb(bytes.subarray(i, i + rate));

    const last = new Uint8Array(rate);
    last.set(bytes.subarray(i, len), 0);
    last[len - i] ^= 0x01;
    last[rate - 1] ^= 0x80;
    absorb(last);

    let hex = "";
    for (let k = 0; k < 32; k++) {
      hex += Number((s[k >> 3] >> BigInt(8 * (k & 7))) & 0xffn).toString(16).padStart(2, "0");
    }
    return hex;
  }

  root.keccak256 = keccak256;
})(typeof globalThis !== "undefined" ? globalThis : this);
