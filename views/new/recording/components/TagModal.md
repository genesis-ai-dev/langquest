# TagModal Component

## Descrição
Componente modal para atribuição de tags. Permite buscar e selecionar múltiplas tags da tabela `tag` do Drizzle usando o `tagService`.

## Funcionalidades do TagService

O componente utiliza os seguintes métodos do `tagService`:

- `searchTags(searchTerm?, limit)`: Busca tags por padrão na chave (`key LIKE %termo%`)
- `getAllActiveTags(limit)`: Retorna todas as tags ativas
- Ordenação automática por `key` 
- Filtro de tags ativas (`active = true`)

## Propriedades

```typescript
interface TagModalProps {
  isVisible: boolean;           // Controla a visibilidade do modal
  selectedTag?: Tag;            // Tag pré-selecionada (opcional)
  searchTerm?: string;          // Termo de busca inicial (opcional)
  limit?: number;               // Número máximo de tags retornadas (padrão: 20)
  onClose: () => void;          // Função chamada ao fechar o modal
  onAssignTags: (tags: Tag[]) => void; // Função chamada ao atribuir tags
}
```

## Comportamento

- **Se `searchTerm` for fornecido**: Lista todas as tags onde a `key` contenha o termo de busca
- **Se `searchTerm` estiver vazio**: Mostra um input de busca para o usuário pesquisar
- **Limitador**: O parâmetro `limit` controla quantas tags são retornadas (padrão: 20)
- **Seleção múltipla**: Permite selecionar/desselecionar múltiplas tags
- **Tag pré-selecionada**: Se `selectedTag` for fornecida, inicia com essa tag selecionada

## Exemplo de Uso

```typescript
import { TagModal } from './TagModal';
import type { Tag } from '@/hooks/db/useSearchTags';

function MyComponent() {
  const [isTagModalVisible, setIsTagModalVisible] = useState(false);
  const [selectedTag, setSelectedTag] = useState<Tag | undefined>();

  const handleAssignTags = (tags: Tag[]) => {
    console.log('Tags selecionadas:', tags);
    // Implementar lógica de atribuição das tags
  };

  return (
    <>
      <Button onPress={() => setIsTagModalVisible(true)}>
        Atribuir Tags
      </Button>
      
      <TagModal
        isVisible={isTagModalVisible}
        selectedTag={selectedTag}
        searchTerm="" // Vazio para mostrar input de busca
        limit={20}
        onClose={() => setIsTagModalVisible(false)}
        onAssignTags={handleAssignTags}
      />
    </>
  );
}
```

## Busca com Termo Pré-definido

```typescript
<TagModal
  isVisible={isTagModalVisible}
  searchTerm="categoria" // Busca tags que contenham "categoria"
  limit={15}
  onClose={() => setIsTagModalVisible(false)}
  onAssignTags={handleAssignTags}
/>
```