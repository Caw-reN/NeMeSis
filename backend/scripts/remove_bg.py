import sys
import io
import traceback
from rembg import remove, new_session
from PIL import Image

def main():
    if len(sys.argv) < 3:
        print("Usage: python remove_bg.py <input_path> <output_path>")
        sys.exit(1)
        
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    
    try:
        with open(input_path, 'rb') as i:
            input_data = i.read()
            
        # Call rembg with a lightweight model (u2netp) to prevent OOM on VPS
        session = new_session("u2netp")
        output_data = remove(input_data, session=session)
        
        # Save output data to the specified output path
        img = Image.open(io.BytesIO(output_data))
        img.save(output_path, 'PNG')
        
    except Exception as e:
        print(f"Error processing image: {e}")
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
