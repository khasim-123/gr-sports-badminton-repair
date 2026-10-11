import math
from typing import Tuple, Dict, Any
from app.models import DistanceConfigModel

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points on the earth in kilometers.
    """
    R = 6371.0  # Earth's radius in kilometers

    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2.0) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(R * c, 1)

def calculate_delivery_charge(
    distance_km: float,
    config: DistanceConfigModel
) -> Dict[str, Any]:
    """
    Calculate delivery charge according to distance pricing configuration.
    Free delivery up to freeRadiusKm (default 10 KM).
    """
    free_radius = config.freeRadiusKm or 10.0
    per_km_rate = config.perKmRateBeyondFree or 15.0

    if distance_km <= free_radius:
        return {
            "charge": 0.0,
            "isFree": True,
            "chargeableKm": 0.0,
            "distanceKm": distance_km
        }

    chargeable_km = round(distance_km - free_radius, 1)

    if config.pricingMethod == "SLAB" and config.slabs:
        matched_slab = None
        for slab in config.slabs:
            if slab.get("minKm", 0) <= distance_km <= slab.get("maxKm", 9999):
                matched_slab = slab
                break
        if matched_slab:
            charge = float(matched_slab.get("price", 0.0))
        else:
            charge = float(round(chargeable_km * per_km_rate))
    else:
        charge = float(round(chargeable_km * per_km_rate))

    return {
        "charge": charge,
        "isFree": False,
        "chargeableKm": chargeable_km,
        "distanceKm": distance_km
    }
