#!/bin/bash
# Script de vérification du projet Stripe

echo "🔍 Vérification du Projet Node.js Stripe..."
echo ""

# 1. Vérifier .env
echo "1️⃣  Vérifier .env..."
if [ -f ".env" ]; then
    echo "   ✅ .env existe"
    # Vérifier les clés essentielles
    if grep -q "MONGODB_URI" .env; then
        echo "   ✅ MONGODB_URI configurée"
    else
        echo "   ❌ MONGODB_URI manquante"
    fi
    
    if grep -q "STRIPE_SECRET_KEY" .env; then
        echo "   ✅ STRIPE_SECRET_KEY configurée"
    else
        echo "   ❌ STRIPE_SECRET_KEY manquante"
    fi
    
    if grep -q "STRIPE_PUBLISHABLE_KEY" .env; then
        echo "   ✅ STRIPE_PUBLISHABLE_KEY configurée"
    else
        echo "   ❌ STRIPE_PUBLISHABLE_KEY manquante"
    fi
else
    echo "   ❌ .env manquant!"
fi
echo ""

# 2. Vérifier .gitignore
echo "2️⃣  Vérifier .gitignore..."
if grep -q ".env" .gitignore; then
    echo "   ✅ .env est ignoré par Git"
else
    echo "   ❌ .env n'est pas ignoré!"
fi
echo ""

# 3. Vérifier les fichiers essentiels
echo "3️⃣  Vérifier les fichiers essentiels..."
files=(
    "app.js"
    "package.json"
    "utils/email.js"
    "utils/database.js"
    "models/User.js"
    "models/Product.js"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✅ $file"
    else
        echo "   ❌ $file manquant"
    fi
done
echo ""

# 4. Vérifier la documentation
echo "4️⃣  Vérifier la documentation..."
docs=(
    "00-LIRE-MOI-EN-PREMIER.md"
    "QUICK-START.md"
    "SETUP-GUIDE.md"
    "TESTING-GUIDE.md"
    "SECURITY-CHECKLIST.md"
)

for doc in "${docs[@]}"; do
    if [ -f "$doc" ]; then
        echo "   ✅ $doc"
    else
        echo "   ❌ $doc manquant"
    fi
done
echo ""

# 5. Vérifier node_modules
echo "5️⃣  Vérifier node_modules..."
if [ -d "node_modules" ]; then
    echo "   ✅ node_modules existe"
else
    echo "   ❌ node_modules manquent (exécuter: npm install)"
fi
echo ""

# 6. Vérifier les dépendances critiques
echo "6️⃣  Vérifier les dépendances critiques..."
if npm list stripe > /dev/null 2>&1; then
    echo "   ✅ stripe"
else
    echo "   ❌ stripe manquant"
fi

if npm list express > /dev/null 2>&1; then
    echo "   ✅ express"
else
    echo "   ❌ express manquant"
fi

if npm list mongoose > /dev/null 2>&1; then
    echo "   ✅ mongoose"
else
    echo "   ❌ mongoose manquant"
fi

if npm list nodemailer > /dev/null 2>&1; then
    echo "   ✅ nodemailer"
else
    echo "   ❌ nodemailer manquant"
fi
echo ""

echo "✅ Vérification terminée!"
echo ""
echo "Prochaines étapes:"
echo "1. Lire: 00-LIRE-MOI-EN-PREMIER.md"
echo "2. Lire: QUICK-START.md"
echo "3. Exécuter: npm start"
echo ""
echo "Bon développement! 🚀"
