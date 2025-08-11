const { createApp, ref, computed, onMounted, onBeforeUnmount } = Vue;
const { useLocalStorage } = VueUse;

createApp({
  setup() {
    const items = useLocalStorage("shopping-list", []);

    // Estado para edição: índice do item sendo editado (-1 = nenhum)
    const editingIndex = ref(-1);

    const newItem = ref({ name: "", quantity: 1, validade: "" });

    const message = ref("");

    const canAdd = computed(() => {
      return (
        newItem.value.name.trim() !== "" &&
        newItem.value.quantity > 0 &&
        newItem.value.validade !== ""
      );
    });

    function resetForm() {
      newItem.value = { name: "", quantity: 1, validade: "" };
      editingIndex.value = -1;
    }

    function addItem() {
      if (!canAdd.value) return;

      if (editingIndex.value === -1) {
        // Adicionar novo item
        items.value.push({
          name: newItem.value.name.trim(),
          quantity: newItem.value.quantity,
          validade: newItem.value.validade,
        });
        message.value = "Item adicionado!";
      } else {
        // Salvar edição
        items.value[editingIndex.value] = {
          name: newItem.value.name.trim(),
          quantity: newItem.value.quantity,
          validade: newItem.value.validade,
        };
        message.value = "Item editado!";
      }

      resetForm();
      clearMessage();
    }

    function removeItem(index) {
      if (editingIndex.value === index) resetForm();
      items.value.splice(index, 1);
      message.value = "Item removido!";
      clearMessage();
    }

    // Inicia edição do item
    function editItem(index) {
      const item = items.value[index];
      newItem.value = { ...item }; // copia os dados
      editingIndex.value = index;
    }

    function exportList() {
      if (items.value.length === 0) {
        message.value = "Lista vazia para exportar.";
        clearMessage();
        return;
      }
      const jsonStr = JSON.stringify(items.value, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "lista-compras.json";
      a.click();
      URL.revokeObjectURL(url);
      message.value = "Lista exportada com sucesso!";
      clearMessage();
    }

    function importList(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          if (
            Array.isArray(imported) &&
            imported.every(
              (i) => i.name && i.quantity && typeof i.validade === "string"
            )
          ) {
            items.value = imported;
            message.value = "Lista importada com sucesso!";
            resetForm();
          } else {
            message.value = "Arquivo JSON inválido.";
          }
        } catch {
          message.value = "Erro ao ler o arquivo.";
        }
        clearMessage();
        event.target.value = null;
      };
      reader.readAsText(file);
    }

    function formatDate(dateStr) {
      if (!dateStr) return "-";
      const d = new Date(dateStr);
      return d.toLocaleDateString();
    }

    function requestNotificationPermission() {
      if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") {
            console.log("Permissão para notificações concedida!");
          }
        });
      }
    }

    function sendExpiryNotification(count) {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Lista de Compras", {
          body: `⚠️ Você tem ${count} item(s) com validade próxima!`,
          icon: "https://cdn-icons-png.flaticon.com/512/3524/3524659.png",
        });
      }
    }

    // Verifica se horário atual está próximo dos horários das notificações (8h ou 18h)
    function isNotificationTime() {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();

      // Checa se está entre hh:00 e hh:01 para evitar notificações repetidas
      const is8am = hour === 8 && minute === 0;
      const is6pm = hour === 18 && minute === 0;

      return is8am || is6pm;
    }

    // Para evitar múltiplas notificações em um mesmo minuto
    let lastNotificationMinute = null;

    function checkExpiringItems() {
      const now = new Date();
      const soon = new Date();
      soon.setDate(now.getDate() + 3);

      const expiring = items.value.filter((item) => {
        if (!item.validade) return false;
        const val = new Date(item.validade);
        return val >= now && val <= soon;
      });

      if (expiring.length > 0) {
        message.value = `⚠️ ${expiring.length} item(s) com validade próxima!`;

        const currentMinute = now.getHours() * 60 + now.getMinutes();
        if (isNotificationTime() && lastNotificationMinute !== currentMinute) {
          sendExpiryNotification(expiring.length);
          lastNotificationMinute = currentMinute;
        }

        clearMessage();
      }
    }

    let intervalId;
    onMounted(() => {
      requestNotificationPermission();
      checkExpiringItems();

      // Checa a cada minuto
      intervalId = setInterval(checkExpiringItems, 60 * 1000);
    });

    onBeforeUnmount(() => {
      clearInterval(intervalId);
    });

    function clearMessage() {
      setTimeout(() => (message.value = ""), 3000);
    }

    return {
      items,
      newItem,
      message,
      canAdd,
      addItem,
      removeItem,
      editItem,
      exportList,
      importList,
      formatDate,
      editingIndex,
    };
  },
}).mount("#app");
