exports.get404 = (req, res, next) => {
    // Envoyer le fichier 404.html pour toute requête non correspondante
    res.status(404).render('404', {pageTitle : 'Page Not Found'});
};