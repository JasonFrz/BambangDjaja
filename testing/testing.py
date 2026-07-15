import requests
import json
import sys

# Konfigurasi Backend URL
BASE_URL = "http://localhost:5000/api/provision/activate"

def main():
    print("="*50)
    print(" TMU CLIENT PROVISIONING TESTER ")
    print("="*50)
    
    # Meminta input token dari pengguna
    token = input("Masukkan Provisioning Token (6 digit): ").strip()
    
    if not token:
        print("Token tidak boleh kosong!")
        sys.exit(1)
        
    # Serial number palsu untuk testing
    dummy_serial = "TEST-RPI-MAC-001"
    
    print(f"\nMengirim token {token} ke backend...")
    
    payload = {
        "provision_token": token,
        "serial_number": dummy_serial
    }
    
    try:
        response = requests.post(BASE_URL, json=payload)
        
        # Mengecek apakah responsnya JSON
        try:
            data = response.json()
        except json.JSONDecodeError:
            print("\n❌ Error: Server tidak mengembalikan format JSON.")
            print(response.text)
            sys.exit(1)
            
        if response.status_code == 200 and data.get("status") == 200:
            print("\n✅ PROVISIONING BERHASIL!")
            print("-" * 50)
            print("Konfigurasi yang diterima (.env format):")
            
            env_config = data.get("env_config", {})
            for key, value in env_config.items():
                print(f"{key} = {value}")
                
            print("-" * 50)
            print(f"Versi TMU: v{data.get('tmu_version')}")
            
        else:
            print("\n❌ PROVISIONING GAGAL!")
            print(f"Pesan Error: {data.get('error') or data.get('message') or 'Unknown Error'}")
            
    except requests.exceptions.ConnectionError:
        print("\n❌ Error: Tidak dapat terhubung ke Backend.")
        print("Pastikan Backend (node server.js) sedang berjalan di port 5000.")

if __name__ == "__main__":
    main()
