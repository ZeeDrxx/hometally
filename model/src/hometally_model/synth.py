"""Synthetic OCR'd receipts for training.

Real receipts are personal data and there is no public Moroccan receipt dataset, so training data
is generated: merchants and items typical of each category, French and Arabic lines, prices in
MAD, and OCR noise (O/0 and l/1 swaps, dropped letters, merged words, upper case).

Merchants are split between train and test, so the test score measures what matters on a phone:
recognising the category of a shop the model has never seen.
"""

from __future__ import annotations

import random
from dataclasses import dataclass

CATEGORIES = [
    "groceries", "restaurants", "transport", "utilities", "telecom",
    "health", "clothing", "household", "education", "leisure",
]


@dataclass(frozen=True)
class Category:
    merchants: list[str]
    items: list[str]
    extras: list[str]  # lines that only some receipts of this category carry


C: dict[str, Category] = {
    "groceries": Category(
        ["Marjane", "Carrefour Market", "BIM", "Aswak Assalam", "Label'Vie", "Acima", "Atacadao", "Supeco",
         "Epicerie Al Baraka", "Hanout Si Mohamed", "Superette Nour", "Mini Market Zahra", "مخبزة الأمل", "Epicerie Fine Oasis"],
        ["Lait Centrale 1L", "Huile Lesieur 1L", "Sucre morceaux 1kg", "Farine Mouna 5kg", "The Sultan vert 200g",
         "Pates Dari 500g", "Tomates kg", "Oeufs x12", "Yaourt Jaouda", "Eau Sidi Ali 1.5L", "Pain", "Fromage La vache qui rit",
         "Riz 1kg", "Lentilles 500g", "Oignons kg", "Pommes de terre kg", "Beurre 250g", "Olives", "Sardines boite", "Cafe moulu 250g",
         "حليب", "سكر", "زيت المائدة", "خبز"],
        ["CAISSE 03", "Carte fidelite", "Articles: 0", "TVA 7%", "Rendu monnaie"],
    ),
    "restaurants": Category(
        ["Cafe Al Andalous", "Snack Chez Hamid", "Pizzeria Venezia", "McDonald's", "KFC", "Paul", "Starbucks",
         "Restaurant Dar Tajine", "Cafe de France", "Snack Ramadan", "Cafe La Corniche", "Burger King", "Sushi Box", "مقهى النخيل"],
        ["Cafe noir", "Nous nous", "The a la menthe", "Msemen", "Tajine poulet", "Couscous", "Pizza margherita", "Panini thon",
         "Jus d'orange", "Harira", "Sandwich kefta", "Menu Big Mac", "Crepe", "Eau minerale", "Coca 33cl", "Salade marocaine",
         "Brochettes", "Tacos poulet", "قهوة", "أتاي"],
        ["Table 4", "Serveur: Youssef", "Couverts: 0", "Sur place", "A emporter", "Service compris"],
    ),
    "transport": Category(
        ["Afriquia", "Shell", "TotalEnergies", "Winxo", "Petrom", "OLA Energy", "ONCF", "CTM", "Supratours",
         "Autoroutes du Maroc", "Parking Twin Center", "Al Boraq", "Station Ziz", "محطة إفريقيا"],
        ["Gasoil 50", "Sans Plomb", "Litres", "Prix/L", "Billet Casa Voyageurs - Rabat Agdal", "Classe 2", "Peage Casa-Rabat",
         "Parking 2h", "Lavage auto", "Huile moteur", "Bus Casablanca - Marrakech", "Train Al Boraq Tanger", "Pompe 04",
         "Vidange", "Pneu", "Ticket tram", "تذكرة"],
        ["Pompe 06", "Immatriculation", "Kilometrage", "Voie 3", "Siege 12A"],
    ),
    "utilities": Category(
        ["Lydec", "Redal", "Amendis", "ONEE", "RADEEMA", "RADEEF", "RAK", "ONEE Branche Eau"],
        ["Facture eau", "Electricite", "Consommation kWh", "Consommation m3", "Redevance fixe", "Abonnement", "Periode",
         "Index ancien", "Index nouveau", "Assainissement", "Taxe audiovisuelle", "Timbre", "Reference client", "Compteur",
         "الماء", "الكهرباء", "الاستهلاك"],
        ["Date limite de paiement", "Contrat N", "Tranche 2", "Puissance souscrite"],
    ),
    "telecom": Category(
        ["Maroc Telecom", "inwi", "Orange", "IAM Agence", "Boutique inwi", "Orange Shop", "اتصالات المغرب"],
        ["Recharge", "Forfait mobile", "Internet ADSL", "Fibre optique", "Pass Internet", "Box 4G", "Jawal", "Facture mensuelle",
         "Abonnement fibre", "Carte SIM", "Recharge *3", "Forfait 99 DH", "Appels illimites", "Go data", "تعبئة"],
        ["Numero d'appel", "Ligne", "Offre", "Code client"],
    ),
    "health": Category(
        ["Pharmacie Al Amal", "Pharmacie du Centre", "Pharmacie Ibn Sina", "Clinique Al Farabi", "Laboratoire Bio Lab",
         "Cabinet Dr Benali", "Pharmacie de Nuit", "Centre de radiologie", "صيدلية الشفاء", "Pharmacie Hassan II"],
        ["Doliprane 1000mg", "Ordonnance", "Consultation", "Analyses sanguines", "Amoxicilline", "Sirop toux", "Vitamine C",
         "Pansements", "Radio thorax", "Echographie", "Spasfon", "Creme solaire", "Masques", "Thermometre", "دواء", "وصفة"],
        ["Feuille de soins", "AMO", "Mutuelle", "Medecin traitant"],
    ),
    "clothing": Category(
        ["Zara", "LC Waikiki", "Marwa", "Defacto", "Kiabi", "H&M", "Bata", "Celio", "Mango", "Decathlon Textile",
         "Boutique Yasmine", "Koton", "ملابس النجمة"],
        ["T-shirt", "Jean slim", "Chaussures", "Robe", "Veste", "Taille M", "Taille L", "Pointure 42", "Pull", "Chemise",
         "Djellaba", "Babouches", "Echarpe", "Chaussettes x3", "Pantalon", "Sac a main", "قميص"],
        ["Echange sous 30 jours", "Ref article", "Coloris", "Remise soldes"],
    ),
    "household": Category(
        ["Kitea", "Ikea", "Bricoma", "Mr Bricolage", "Electroplanet", "Biougnach", "Home Center", "Droguerie Al Fath",
         "Quincaillerie Atlas", "Virgin Megastore Maison", "أثاث المنزل"],
        ["Ampoule LED", "Perceuse", "Rideau", "Chaise", "Peinture blanche 5L", "Matelas", "Lampe", "Tapis", "Etagere", "Vis",
         "Cable electrique", "Robinet", "Machine a laver", "Refrigerateur", "Aspirateur", "Casserole", "Poubelle", "Serrure"],
        ["Livraison", "Garantie 2 ans", "Montage", "Retrait magasin"],
    ),
    "education": Category(
        ["Librairie Papeterie Al Ilm", "Librairie Nationale", "Ecole Al Massira", "Groupe Scolaire Les Lauriers",
         "Centre de Langues", "Institut Pascal", "Universite Inscription", "مكتبة المعرفة", "Librairie Carrefour du Livre"],
        ["Cahier 96 pages", "Stylo bleu", "Manuel de mathematiques", "Frais de scolarite", "Inscription", "Cours de soutien",
         "Cartable", "Calculatrice", "Photocopies", "Frais d'examen", "Dictionnaire", "Classeur", "Trousse", "كتاب", "دفتر"],
        ["Annee scolaire 2025-2026", "Eleve", "Niveau", "Trimestre 1"],
    ),
    "leisure": Category(
        ["Megarama", "Pathe", "City Club", "Hammam Al Fath", "Aquaparc", "Bowling Morocco Mall", "Kidzania", "Fitness Park",
         "Musee Yves Saint Laurent", "Stade Mohammed V Billetterie", "Escape Game Casa", "حمام النصر"],
        ["Billet adulte", "Seance 20h30", "Abonnement mensuel", "Pop corn", "Entree hammam", "Gommage", "Massage",
         "Partie bowling", "Billet match", "Entree enfant", "Location chaussures", "Cours de natation", "Coaching", "تذكرة دخول"],
        ["Salle 5", "Place 12", "Tribune", "Valable aujourd'hui"],
    ),
}

CITIES = ["Casablanca", "Rabat", "Marrakech", "Fes", "Tanger", "Agadir", "Meknes", "Oujda", "Kenitra", "Tetouan"]
TOTAL_WORDS = ["TOTAL", "TOTAL TTC", "NET A PAYER", "MONTANT", "Total a payer", "المجموع", "TOTAL DH"]
FOOTERS = ["Merci de votre visite", "A bientot", "Merci", "شكرا على زيارتكم", "Conservez votre ticket", ""]
PAYMENTS = ["Especes", "Carte bancaire", "CB", "Paiement mobile", "نقدا"]
OCR_SWAPS = {"o": "0", "O": "0", "l": "1", "i": "1", "s": "5", "S": "5", "e": "c", "a": "a", "B": "8", "g": "9"}


@dataclass(frozen=True)
class Vocab:
    merchants: dict[str, list[str]]
    items: dict[str, list[str]]


def split_vocab(seed: int = 0, test_share: float = 0.25) -> tuple[Vocab, Vocab]:
    """Hold out a share of merchants AND items per category: test receipts come from shops and
    products the model never saw, which is what a phone in a new neighbourhood will meet."""
    rng = random.Random(seed)

    def split(values: list[str]) -> tuple[list[str], list[str]]:
        values = values[:]
        rng.shuffle(values)
        k = max(2, round(len(values) * test_share))
        return values[k:], values[:k]

    train, test = Vocab({}, {}), Vocab({}, {})
    for cat, spec in C.items():
        train.merchants[cat], test.merchants[cat] = split(spec.merchants)
        train.items[cat], test.items[cat] = split(spec.items)
    return train, test


def _price(rng: random.Random) -> str:
    v = rng.choice([rng.uniform(2, 40), rng.uniform(20, 300), rng.uniform(100, 2000)])
    s = f"{v:.2f}"
    return s.replace(".", ",") if rng.random() < 0.5 else s


def _noise(text: str, rng: random.Random, level: float) -> str:
    out = []
    for ch in text:
        r = rng.random()
        if r < level * 0.4 and ch in OCR_SWAPS:
            out.append(OCR_SWAPS[ch])
        elif r < level * 0.6:
            continue  # dropped character
        elif r < level * 0.7 and ch == " ":
            continue  # merged words
        else:
            out.append(ch)
    return "".join(out)


def receipt(category: str, merchant: str, rng: random.Random, items: list[str] | None = None) -> str:
    spec = C[category]
    items = items or spec.items
    lines = [merchant if rng.random() < 0.7 else merchant.upper()]
    if rng.random() < 0.6:
        lines.append(f"{rng.randint(1, 300)} Bd {rng.choice(['Zerktouni', 'Mohammed V', 'Hassan II', 'Anfa', 'Al Massira'])} {rng.choice(CITIES)}")
    if rng.random() < 0.5:
        lines.append(f"ICE {rng.randint(10**14, 10**15 - 1)}")
    lines.append(f"{rng.randint(1, 28):02d}/{rng.randint(1, 12):02d}/202{rng.randint(4, 6)} {rng.randint(7, 22):02d}:{rng.randint(0, 59):02d}")
    for _ in range(rng.randint(1, 7)):
        item = rng.choice(items)
        qty = f"{rng.randint(1, 4)} x " if rng.random() < 0.4 else ""
        lines.append(f"{qty}{item} {_price(rng)}")
    for extra in rng.sample(spec.extras, k=rng.randint(0, min(2, len(spec.extras)))):
        lines.append(extra.replace("0", str(rng.randint(1, 9))))
    lines.append(f"{rng.choice(TOTAL_WORDS)} {_price(rng)}")
    if rng.random() < 0.6:
        lines.append(rng.choice(PAYMENTS))
    lines.append(rng.choice(FOOTERS))
    text = "\n".join(l for l in lines if l)
    if rng.random() < 0.3:
        text = text.upper()
    return _noise(text, rng, level=rng.choice([0.0, 0.02, 0.05, 0.1]))


def dataset(n_per_class: int, vocab: Vocab, seed: int) -> tuple[list[str], list[int]]:
    rng = random.Random(seed)
    texts, labels = [], []
    for label, cat in enumerate(CATEGORIES):
        for _ in range(n_per_class):
            texts.append(receipt(cat, rng.choice(vocab.merchants[cat]), rng, vocab.items[cat]))
            labels.append(label)
    order = list(range(len(texts)))
    rng.shuffle(order)
    return [texts[i] for i in order], [labels[i] for i in order]
