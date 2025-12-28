const path = require('path');

// Exporter le répertoire du fichier principal de l'application
// Utilise require.main.filename au lieu de process.mainModule.filename (déprécié)
module.exports = path.dirname(require.main.filename);