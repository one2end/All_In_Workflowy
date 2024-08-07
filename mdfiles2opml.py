import os
import xml.etree.ElementTree as ET

def create_outline_element(file_path):
    with open(file_path, 'r', encoding='utf-8') as file:
        content = file.read()
    file_name = os.path.basename(file_path).replace('.md', '')
    outline = ET.Element('outline', text=file_name, _note=content)
    return outline

def add_outlines_to_parent(parent, directory):
    for item in sorted(os.listdir(directory)):
        item_path = os.path.join(directory, item)
        if os.path.isdir(item_path):
            folder_outline = ET.Element('outline', text=item)
            add_outlines_to_parent(folder_outline, item_path)
            parent.append(folder_outline)
        elif item.endswith('.md'):
            file_outline = create_outline_element(item_path)
            parent.append(file_outline)

def create_opml(directory):
    opml = ET.Element('opml', version='2.0')
    head = ET.SubElement(opml, 'head')
    owner_email = ET.SubElement(head, 'ownerEmail')
    owner_email.text = 'abcde@outlook.com'
    body = ET.SubElement(opml, 'body')
    add_outlines_to_parent(body, directory)
    return opml

def save_opml(opml, output_file):
    tree = ET.ElementTree(opml)
    tree.write(output_file, encoding='utf-8', xml_declaration=True)

if __name__ == '__main__':
    directory = '4-Archive'  # 指定根目录
    output_file = 'output.opml'
    opml = create_opml(directory)
    save_opml(opml, output_file)
    print(f'OPML 文件已保存到 {output_file}')
