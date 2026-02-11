"""Add parking_details table with GTT enrichment data and seed data

Revision ID: 003
Revises: 002
Create Date: 2026-02-11
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# 5T ID → GTT scraped data (22 GTT-managed + extras marked as non-GTT)
SEED_DATA = [
    {
        "parking_id": 53, "address": "Via Ancona 17/A", "district": "Circoscrizione 7",
        "operator": "GTT", "disabled_spots": 8, "is_covered": True, "open_24h": True,
        "hourly_rate_daytime": 1.20, "hourly_rate_nighttime": None, "daily_rate": None,
        "monthly_subscription": 65.00, "bus_lines": ["8", "57"],
        "has_metro_access": False, "payment_methods": ["contanti", "carte"],
        "cameras": 31, "notes": "Accesso notturno 00-06 solo abbonati",
    },
    {
        "parking_id": 46, "address": "Corso Spezia 44", "district": "Circoscrizione 8",
        "operator": "GTT", "disabled_spots": 6, "floors": 1, "is_covered": False,
        "open_24h": True, "hourly_rate_daytime": 1.00, "hourly_rate_nighttime": 0.80,
        "daily_rate": 7.00, "monthly_subscription": 65.00,
        "bus_lines": ["17", "17/", "42", "74"], "has_metro_access": False,
        "payment_methods": ["cassa automatica"], "cameras": 7, "notes": "Zona ospedaliera",
    },
    {
        "parking_id": 47, "address": "Via Bixio 8E", "district": "Circoscrizione 3",
        "operator": "GTT", "disabled_spots": 6, "is_covered": True, "open_24h": True,
        "hourly_rate_daytime": 1.00, "hourly_rate_nighttime": 0.80, "daily_rate": 7.00,
        "monthly_subscription": 65.00,
        "bus_lines": ["9", "55", "56", "60", "68", "Star 1"], "has_metro_access": False,
        "payment_methods": ["cassa automatica"], "cameras": 27,
        "notes": "Linea Star gratuita con biglietto parcheggio",
    },
    {
        "parking_id": 23, "address": "Corso Unione Sovietica / Via Rignon",
        "district": "Circoscrizione 2", "operator": "GTT", "disabled_spots": 12,
        "is_covered": False, "open_24h": True,
        "hourly_rate_daytime": 0.50, "hourly_rate_nighttime": 0.50, "daily_rate": 5.50,
        "monthly_subscription": 35.00,
        "bus_lines": ["2", "4", "10", "18", "38", "39", "40", "41", "43", "62", "63"],
        "has_metro_access": False,
        "payment_methods": ["cassa automatica"], "cameras": 43,
        "notes": "Park&Ride. Include area camper 57 posti",
    },
    {
        "parking_id": 4, "address": "Corso Massimo D'Azeglio ang. Via Cellini",
        "district": "Circoscrizione 8", "operator": "GTT", "disabled_spots": 5,
        "is_covered": True, "open_24h": True,
        "hourly_rate_daytime": 1.00, "hourly_rate_nighttime": 0.80, "daily_rate": 7.00,
        "monthly_subscription": 65.00,
        "bus_lines": ["42", "45", "45/", "47", "66", "67"], "has_metro_access": False,
        "payment_methods": ["cassa automatica"], "cameras": 16, "notes": "",
    },
    {
        "parking_id": 24, "address": "Via De Amicis / Via Fermi", "district": "Collegno",
        "operator": "GTT", "disabled_spots": 8, "is_covered": True, "open_24h": True,
        "hourly_rate_daytime": 0.50, "hourly_rate_nighttime": 0.50, "daily_rate": 5.50,
        "monthly_subscription": 35.00,
        "bus_lines": ["33", "37", "76", "CO1"], "has_metro_access": True,
        "payment_methods": ["cassa automatica"], "cameras": 10,
        "notes": "Park&Ride. Vicino capolinea Metro linea 1",
    },
    {
        "parking_id": 16, "address": "Via Fontanesi / Via Porro",
        "district": "Circoscrizione 7", "operator": "GTT", "disabled_spots": 8,
        "is_covered": True, "open_24h": True,
        "hourly_rate_daytime": 1.00, "hourly_rate_nighttime": 0.80, "daily_rate": 7.00,
        "monthly_subscription": 65.00,
        "bus_lines": ["Star 1", "3", "6", "15", "30", "55", "75", "77"],
        "has_metro_access": False, "payment_methods": ["cassa automatica"],
        "cameras": 45, "notes": "Parcheggio automatizzato. Linea Star gratuita",
    },
    {
        "parking_id": 60, "address": "Piazzale Chiribiri ang. Via Lancia",
        "district": "Circoscrizione 3", "operator": "GTT", "disabled_spots": 9,
        "floors": 4, "is_covered": True, "open_24h": True,
        "hourly_rate_daytime": 1.00, "hourly_rate_nighttime": 0.80, "daily_rate": 7.00,
        "monthly_subscription": 65.00,
        "bus_lines": ["55", "56", "64"], "has_metro_access": False,
        "payment_methods": ["cassa automatica"], "cameras": 90,
        "notes": "4 piani: 1 interrato + 3 in elevazione",
    },
    {
        "parking_id": 25, "address": "Corso Dogliotti", "district": "Circoscrizione 8",
        "operator": "GTT", "disabled_spots": 19, "is_covered": True, "open_24h": True,
        "hourly_rate_daytime": 1.00, "hourly_rate_nighttime": 0.80, "daily_rate": 7.00,
        "monthly_subscription": 65.00,
        "bus_lines": ["8", "17", "18", "42", "45", "47", "66", "67"],
        "has_metro_access": True, "payment_methods": ["cassa automatica"],
        "cameras": 90, "notes": "Dentro complesso Ospedale San Giovanni Battista",
    },
    {
        "parking_id": 56, "address": "Via Monti 40/b", "district": "Circoscrizione 8",
        "operator": "GTT", "disabled_spots": 4, "is_covered": True, "open_24h": True,
        "hourly_rate_daytime": 1.00, "hourly_rate_nighttime": 0.80, "daily_rate": 7.00,
        "monthly_subscription": 65.00,
        "bus_lines": ["42", "67"], "has_metro_access": True,
        "payment_methods": ["cassa automatica"], "cameras": 30,
        "notes": "Stazione metro Dante a ~750m",
    },
    {
        "parking_id": 9, "address": "Via Chisola / Via Pagliani",
        "district": "Circoscrizione 8", "operator": "GTT", "disabled_spots": 8,
        "is_covered": True, "open_24h": True,
        "hourly_rate_daytime": 1.00, "hourly_rate_nighttime": 0.80, "daily_rate": 7.00,
        "monthly_subscription": 65.00,
        "bus_lines": ["8", "17", "17/", "24", "45", "45/", "66"],
        "has_metro_access": True, "payment_methods": ["cassa automatica"],
        "cameras": 30, "notes": "Ingresso pedonale riservato a titolari biglietto/pass",
    },
    {
        "parking_id": 10, "address": "Corso Vittorio Emanuele II / Via Cavalli 15/A",
        "district": "Circoscrizione 3", "operator": "GTT", "disabled_spots": 10,
        "is_covered": True, "open_24h": True,
        "hourly_rate_daytime": 1.00, "hourly_rate_nighttime": 0.80, "daily_rate": 7.00,
        "monthly_subscription": 65.00,
        "bus_lines": ["9", "55", "60", "68", "Star 1", "Star 2"],
        "has_metro_access": True,
        "payment_methods": ["carte", "Visa", "Mastercard", "bancomat", "Telepass"],
        "cameras": 112, "notes": "Parcheggiatori Star parcheggiano gratis",
    },
    {
        "parking_id": 31, "address": "Viale Medaglie d'Oro / Viale Ceppi",
        "district": "Circoscrizione 8", "operator": "GTT",
        "is_covered": False, "open_24h": True,
        "hourly_rate_daytime": 1.00, "hourly_rate_nighttime": None,
        "monthly_subscription": None,
        "bus_lines": ["8", "24", "Star 1", "Star 2"],
        "has_metro_access": True, "payment_methods": ["parcometro"],
        "notes": "ATTUALMENTE CHIUSO AL PUBBLICO. Parco del Valentino",
    },
    {
        "parking_id": 13, "address": "Corso Re Umberto / Corso Matteotti",
        "district": "Circoscrizione 1", "operator": "GTT", "floors": 1,
        "is_covered": False, "open_24h": True,
        "hourly_rate_daytime": 2.00, "hourly_rate_nighttime": 1.60, "daily_rate": 14.00,
        "monthly_subscription": 120.00,
        "bus_lines": ["Star", "14", "15", "29", "55", "57", "59", "59/", "63", "67"],
        "has_metro_access": False,
        "payment_methods": ["cassa automatica", "Telepass"], "cameras": 4,
        "notes": "Ingresso Matteotti chiuso dal 17/05/2021. Solo accesso Piazza Solferino",
    },
    {
        "parking_id": 59, "address": "Via del Sarto 3", "district": "Circoscrizione 4",
        "operator": "GTT", "disabled_spots": 3, "is_covered": True, "open_24h": True,
        "hourly_rate_daytime": 1.00, "hourly_rate_nighttime": 0.80, "daily_rate": 7.00,
        "monthly_subscription": 65.00,
        "bus_lines": ["9", "16 CD", "16 CS", "29", "59", "59/"],
        "has_metro_access": False, "payment_methods": ["cassa automatica"],
        "notes": "Abbonamenti gestiti presso Palagiustizia. 2 posti cortesia donne",
    },
    {
        "parking_id": 14, "address": "Piazza Castello / Piazza Carlo Felice / Via Gobetti",
        "district": "Circoscrizione 1", "operator": "GTT", "disabled_spots": 16,
        "is_covered": True, "open_24h": True,
        "hourly_rate_daytime": 2.00, "hourly_rate_nighttime": 1.40,
        "monthly_subscription": 165.00,
        "bus_lines": ["Star 1", "Star 2", "4", "11", "15", "55", "57", "58", "58/"],
        "has_metro_access": False,
        "payment_methods": ["cassa automatica"], "cameras": 67,
        "notes": "3 ingressi: Piazza Castello, Piazza Carlo Felice, Via Gobetti. Il piu grande del centro",
    },
    {
        "parking_id": 12, "address": "Via Porta Palatina", "district": "Circoscrizione 1",
        "operator": "GTT", "disabled_spots": 9, "is_covered": True, "open_24h": True,
        "hourly_rate_daytime": 2.00, "hourly_rate_nighttime": 1.60, "daily_rate": 14.00,
        "monthly_subscription": 120.00,
        "bus_lines": ["Star 2", "4", "6", "11", "27", "51", "57", "Star 1"],
        "has_metro_access": False,
        "payment_methods": ["carte", "Visa", "Mastercard", "bancomat"],
        "cameras": 32, "notes": "Deposito bagagli es-senza bag. Linea Star 1 gratuita",
    },
    {
        "parking_id": 27, "address": "Piazza Sofia ang. Via Botticelli",
        "district": "Circoscrizione 6", "operator": "GTT", "disabled_spots": 6,
        "is_covered": False, "open_24h": True,
        "hourly_rate_daytime": 0.50, "hourly_rate_nighttime": 0.50,
        "monthly_subscription": 35.00,
        "bus_lines": ["2", "8", "27", "49", "57", "62"], "has_metro_access": False,
        "payment_methods": ["cassa automatica"], "cameras": 24, "notes": "",
    },
    {
        "parking_id": 28, "address": "Corso Romania", "district": "Circoscrizione 6",
        "operator": "GTT", "disabled_spots": 14, "is_covered": False, "open_24h": True,
        "hourly_rate_daytime": 0.50, "hourly_rate_nighttime": 0.50, "daily_rate": 5.50,
        "monthly_subscription": 35.00,
        "bus_lines": ["4", "20", "46N", "50", "51"], "has_metro_access": False,
        "payment_methods": ["carte", "Visa", "Mastercard", "bancomat", "cassa automatica"],
        "cameras": 39, "notes": "Park&Ride. Periferia nord",
    },
    {
        "parking_id": 18, "address": "Via Giolitti / Via Cavour",
        "district": "Circoscrizione 1", "operator": "GTT", "disabled_spots": 11,
        "is_covered": True, "open_24h": True,
        "hourly_rate_daytime": 2.00, "hourly_rate_nighttime": 1.60, "daily_rate": 14.00,
        "monthly_subscription": 140.00,
        "bus_lines": ["8", "61", "68"], "has_metro_access": False,
        "payment_methods": ["cassa automatica"], "cameras": 60,
        "notes": "Centro citta, dentro perimetro ZTL Centrale. 60 telecamere",
    },
    {
        "parking_id": 48, "address": "Corso Francia / Via Mila",
        "district": "Circoscrizione 3", "operator": "GTT", "disabled_spots": 12,
        "is_covered": True, "open_24h": True,
        "hourly_rate_daytime": 0.50, "hourly_rate_nighttime": 0.50, "daily_rate": 5.50,
        "monthly_subscription": 35.00,
        "bus_lines": ["VE1", "36", "40", "62"], "has_metro_access": True,
        "payment_methods": ["cassa automatica"], "cameras": 101,
        "notes": "Park&Ride. Vicino stazione metro Marche. Struttura interrata multilivello. 6 posti GPL, 6 posti cortesia donne",
    },
    {
        "parking_id": 15, "address": "Via Biglieri / Via Baiardi",
        "district": "Circoscrizione 8", "operator": "GTT", "disabled_spots": 7,
        "is_covered": True, "open_24h": True,
        "hourly_rate_daytime": 1.00, "hourly_rate_nighttime": 0.80, "daily_rate": 7.00,
        "monthly_subscription": 65.00,
        "bus_lines": ["8", "17", "17/", "24", "42", "74"], "has_metro_access": False,
        "payment_methods": ["cassa automatica"], "cameras": 3, "notes": "",
    },
]


def upgrade() -> None:
    op.create_table(
        "parking_details",
        sa.Column("parking_id", sa.Integer(), sa.ForeignKey("parkings.id"), primary_key=True),
        sa.Column("address", sa.String(500), nullable=False, server_default=""),
        sa.Column("district", sa.String(100), nullable=False, server_default=""),
        sa.Column("operator", sa.String(100), nullable=False, server_default="GTT"),
        sa.Column("floors", sa.Integer(), nullable=True),
        sa.Column("disabled_spots", sa.Integer(), nullable=True),
        sa.Column("is_covered", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_custodied", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("open_24h", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("hourly_rate_daytime", sa.Numeric(5, 2), nullable=True),
        sa.Column("hourly_rate_nighttime", sa.Numeric(5, 2), nullable=True),
        sa.Column("daily_rate", sa.Numeric(6, 2), nullable=True),
        sa.Column("monthly_subscription", sa.Numeric(7, 2), nullable=True),
        sa.Column("bus_lines", sa.ARRAY(sa.String(20)), nullable=True),
        sa.Column("has_metro_access", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("payment_methods", sa.ARRAY(sa.String(50)), nullable=True),
        sa.Column("cameras", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # Seed the GTT data
    details_table = sa.table(
        "parking_details",
        sa.column("parking_id", sa.Integer),
        sa.column("address", sa.String),
        sa.column("district", sa.String),
        sa.column("operator", sa.String),
        sa.column("floors", sa.Integer),
        sa.column("disabled_spots", sa.Integer),
        sa.column("is_covered", sa.Boolean),
        sa.column("is_custodied", sa.Boolean),
        sa.column("open_24h", sa.Boolean),
        sa.column("hourly_rate_daytime", sa.Numeric),
        sa.column("hourly_rate_nighttime", sa.Numeric),
        sa.column("daily_rate", sa.Numeric),
        sa.column("monthly_subscription", sa.Numeric),
        sa.column("bus_lines", sa.ARRAY(sa.String)),
        sa.column("has_metro_access", sa.Boolean),
        sa.column("payment_methods", sa.ARRAY(sa.String)),
        sa.column("cameras", sa.Integer),
        sa.column("notes", sa.Text),
    )

    for row in SEED_DATA:
        op.execute(
            details_table.insert().values(
                parking_id=row["parking_id"],
                address=row.get("address", ""),
                district=row.get("district", ""),
                operator=row.get("operator", "GTT"),
                floors=row.get("floors"),
                disabled_spots=row.get("disabled_spots"),
                is_covered=row.get("is_covered", True),
                is_custodied=False,
                open_24h=row.get("open_24h", True),
                hourly_rate_daytime=row.get("hourly_rate_daytime"),
                hourly_rate_nighttime=row.get("hourly_rate_nighttime"),
                daily_rate=row.get("daily_rate"),
                monthly_subscription=row.get("monthly_subscription"),
                bus_lines=row.get("bus_lines"),
                has_metro_access=row.get("has_metro_access", False),
                payment_methods=row.get("payment_methods"),
                cameras=row.get("cameras"),
                notes=row.get("notes", ""),
            )
        )


def downgrade() -> None:
    op.drop_table("parking_details")
