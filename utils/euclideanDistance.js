/**
 * Menghitung jarak Euclidean antara dua titik koordinat
 * @param {number} lat1 - Latitude titik pertama
 * @param {number} lon1 - Longitude titik pertama
 * @param {number} lat2 - Latitude titik kedua
 * @param {number} lon2 - Longitude titik kedua
 * @returns {number} - Jarak dalam kilometer
 */
const euclideanDistance = (lat1, lon1, lat2, lon2) => {
    const dx = lat2 - lat1; // Selisih latitude
    const dy = lon2 - lon1; // Selisih longitude
    const distanceInDegrees = Math.sqrt(dx * dx + dy * dy);

    // Faktor konversi dari derajat ke kilometer
    const KM_PER_DEGREE = 111.319;

    const distanceInKm = distanceInDegrees * KM_PER_DEGREE;

    return distanceInKm;
};

module.exports = euclideanDistance;